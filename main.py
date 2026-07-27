"""学邦 EduBoss 课程数据桌面工具。"""

from __future__ import annotations

import base64
import calendar
import ctypes
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import threading
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from tkinter import BOTH, END, LEFT, BooleanVar, Button, Checkbutton, Entry, Frame, Label, PhotoImage, StringVar, Tk, Toplevel, filedialog, messagebox
from tkinter.font import Font
from tkinter.ttk import Combobox, Progressbar, Style
from typing import Any
from urllib.parse import urlencode

import requests


BASE_URL = "https://boss.xuebangsoft.net/eduboss"
INSTITUTION_ID = "262"
RESOURCE_ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
ICON_FILE = RESOURCE_ROOT / "icon" / "orange.ico"
LOGIN_ICON_FILE = RESOURCE_ROOT / "icon" / "orange.png"
AVATAR_ICON_FILE = RESOURCE_ROOT / "icon" / "orange.png"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)


class EduBossError(RuntimeError):
    """可直接展示给用户的请求错误。"""


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", ctypes.c_ulong), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]


class CredentialStore:
    """使用 Windows DPAPI 保存仅当前 Windows 用户可解密的登录历史。"""

    def __init__(self) -> None:
        data_dir = os.environ.get("COURSE_SYNC_DATA_DIR")
        if not data_dir:
            app_data = os.environ.get("APPDATA") or str(Path.home())
            data_dir = str(Path(app_data) / "A大橙子课时统计定制版" / "course-sync")
        self.path = Path(data_dir) / "login_history.json"
        self.keychain_service = "com.adachengzi.kebiao.course-sync"

    @staticmethod
    def _protect(text: str) -> str:
        raw = text.encode("utf-8")
        buffer = ctypes.create_string_buffer(raw)
        source = _DataBlob(len(raw), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
        output = _DataBlob()
        if not ctypes.windll.crypt32.CryptProtectData(
            ctypes.byref(source), None, None, None, None, 0, ctypes.byref(output)
        ):
            raise OSError("无法加密登录信息")
        try:
            encrypted = ctypes.string_at(output.pbData, output.cbData)
            return base64.b64encode(encrypted).decode("ascii")
        finally:
            ctypes.windll.kernel32.LocalFree(output.pbData)

    @staticmethod
    def _unprotect(value: str) -> str:
        raw = base64.b64decode(value)
        buffer = ctypes.create_string_buffer(raw)
        source = _DataBlob(len(raw), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
        output = _DataBlob()
        if not ctypes.windll.crypt32.CryptUnprotectData(
            ctypes.byref(source), None, None, None, None, 0, ctypes.byref(output)
        ):
            raise OSError("无法解密登录信息")
        try:
            return ctypes.string_at(output.pbData, output.cbData).decode("utf-8")
        finally:
            ctypes.windll.kernel32.LocalFree(output.pbData)

    def load(self) -> dict[str, str]:
        if sys.platform == "darwin":
            try:
                content = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, ValueError, TypeError):
                return {}
            credentials: dict[str, str] = {}
            for item in content:
                account = str(item.get("account") or "") if isinstance(item, dict) else ""
                if not account:
                    continue
                result = subprocess.run(
                    [
                        "/usr/bin/security", "find-generic-password",
                        "-s", self.keychain_service, "-a", account, "-w",
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if result.returncode == 0:
                    credentials[account] = result.stdout.rstrip("\r\n")
            return credentials
        try:
            content = json.loads(self.path.read_text(encoding="utf-8"))
            return {
                str(item["account"]): self._unprotect(str(item["password"]))
                for item in content
                if isinstance(item, dict) and item.get("account") and item.get("password")
            }
        except (OSError, ValueError, KeyError, TypeError):
            return {}

    def save(self, credentials: dict[str, str]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if sys.platform == "darwin":
            try:
                previous = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, ValueError, TypeError):
                previous = []
            previous_accounts = {
                str(item.get("account"))
                for item in previous
                if isinstance(item, dict) and item.get("account")
            }
            for account in previous_accounts - set(credentials):
                subprocess.run(
                    [
                        "/usr/bin/security", "delete-generic-password",
                        "-s", self.keychain_service, "-a", account,
                    ],
                    capture_output=True,
                    check=False,
                )
            for account, password in credentials.items():
                result = subprocess.run(
                    [
                        "/usr/bin/security", "add-generic-password", "-U",
                        "-s", self.keychain_service, "-a", account, "-w", password,
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if result.returncode != 0:
                    raise OSError(result.stderr.strip() or "Unable to save credentials to macOS Keychain")
            content = [{"account": account, "storage": "keychain"} for account in credentials]
            self.path.write_text(
                json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            return
        content = [
            {"account": account, "password": self._protect(password)}
            for account, password in credentials.items()
        ]
        self.path.write_text(
            json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8"
        )


class EduBossClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        # 避免 IDE 中无效的代理环境变量影响直连。
        self.session.trust_env = False
        self.teacher_id = ""
        self.teacher_name = ""
        self._attendance_cache: dict[tuple[str, str], Any] = {}
        self._last_attendance_request_at = 0.0

    def begin_attendance_sync(self) -> None:
        """Discard mutable attendance responses before a new sync run."""
        self._attendance_cache.clear()

    @staticmethod
    def _crypt_body(account: str, password: str) -> str:
        timestamp = int(time.time() * 1000)
        unsigned = urlencode(
            {"account": account, "password": password, "timestamp": timestamp}
        )
        code = hashlib.md5(unsigned.encode("utf-8")).hexdigest()
        signed = urlencode(
            {
                "account": account,
                "password": password,
                "timestamp": timestamp,
                "code": code,
            }
        )
        return base64.b64encode(signed.encode("utf-8")).decode("ascii")

    @staticmethod
    def _json(response: requests.Response) -> Any:
        try:
            return response.json()
        except ValueError as exc:
            raise EduBossError("服务器返回了无法识别的数据") from exc

    def login(
        self, account: str, password: str, institution_id: str = INSTITUTION_ID
    ) -> None:
        common_headers = {
            "User-Agent": USER_AGENT,
            "Origin": "https://boss.xuebangsoft.net",
            "Referer": f"{BASE_URL}/login.jsp",
            "X-Requested-With": "XMLHttpRequest",
        }
        try:
            page = self.session.get(
                f"{BASE_URL}/login.jsp",
                headers={"User-Agent": USER_AGENT},
                timeout=15,
            )
            page.raise_for_status()
            crypt_body = self._crypt_body(account, password)

            verify = self.session.post(
                f"{BASE_URL}/web/UserLoginWebController/isNeedLoginVerifyCode.do",
                data={"institutionId": institution_id, "cryptBody": crypt_body},
                headers=common_headers,
                timeout=15,
            )
            verify.raise_for_status()
            verify_data = self._json(verify)
            if (
                isinstance(verify_data, dict)
                and verify_data.get("resultCode") == 0
                and (verify_data.get("data") or {}).get("needVerifyCode")
            ):
                raise EduBossError("该账号需要验证码，暂时无法在此工具中登录")

            headers = {
                **common_headers,
                "Accept": "*/*",
                "Content-Type": "application/json",
                "X-XB-Sign": base64.b64encode(
                    str(int(time.time() * 1000)).encode("ascii")
                ).decode("ascii"),
            }
            response = self.session.post(
                f"{BASE_URL}/api/login",
                json={"institutionId": institution_id, "cryptBody": crypt_body},
                headers=headers,
                timeout=15,
                allow_redirects=False,
            )
            login_data = self._json(response)
            if not response.ok or not (
                self.session.cookies.get("access_token")
                or self.session.cookies.get("JSESSIONID")
            ):
                message = (
                    login_data.get("message", "账号或密码错误")
                    if isinstance(login_data, dict)
                    else "账号或密码错误"
                )
                raise EduBossError(str(message))

            user_response = self.session.get(
                f"{BASE_URL}/SystemAction/getLoginUserInfo.do",
                headers={
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "Referer": f"{BASE_URL}/",
                    "User-Agent": USER_AGENT,
                    "X-Requested-With": "XMLHttpRequest",
                },
                timeout=15,
            )
            user_response.raise_for_status()
            user_data = self._json(user_response)
            if not isinstance(user_data, dict) or user_data.get("resultCode") != 0:
                raise EduBossError("登录成功，但无法读取老师信息")
            self.teacher_id = str(user_data.get("userId") or "")
            self.teacher_name = str(user_data.get("name") or account)
            if not self.teacher_id:
                raise EduBossError("当前账号没有可用的老师 ID")
        except EduBossError:
            raise
        except requests.Timeout as exc:
            raise EduBossError("连接服务器超时，请稍后重试") from exc
        except requests.RequestException as exc:
            raise EduBossError(f"无法连接服务器：{exc}") from exc

    def get_courses(self, start: date, end: date) -> Any:
        try:
            response = self.session.post(
                f"{BASE_URL}/web/GenericCourseQueryWebController/teacherCourse.do",
                json={
                    "startCourseDate": start.isoformat(),
                    "endCourseDate": end.isoformat(),
                    "teacherId": self.teacher_id,
                },
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json;charset=UTF-8",
                    "Referer": f"{BASE_URL}/",
                    "User-Agent": USER_AGENT,
                    "X-Requested-With": "XMLHttpRequest",
                },
                timeout=20,
            )
            response.raise_for_status()
            return self._json(response)
        except EduBossError:
            raise
        except requests.Timeout as exc:
            raise EduBossError("读取课程数据超时，请稍后重试") from exc
        except requests.RequestException as exc:
            raise EduBossError(f"读取课程数据失败：{exc}") from exc

    def get_course_attendance(self, course_type: str, ref_course_id: str) -> Any:
        """读取一节课的学生实际考勤；不同班型使用各自的上游接口。"""
        cache_key = (course_type, ref_course_id)
        if cache_key in self._attendance_cache:
            return self._attendance_cache[cache_key]
        if course_type == "SMALL_CLASS":
            path = (
                "web/MiniClass/MiniClassCourseStudentAttendanceController/"
                "getMiniClassStudentAttendanceList.do"
            )
            params = {
                "miniClassCourseId": ref_course_id,
                "_search": "false",
                "rows": "9999",
                "page": "1",
                "sidx": "",
                "sord": "desc",
            }
        elif course_type == "ONE_ON_ONE_COURSE":
            path = "CourseController/findCourseById.do"
            params = {"id": ref_course_id}
        else:
            return None
        try:
            response = None
            for retry in range(3):
                # 保持顺序访问，并加入轻微随机间隔，避免形成固定频率的密集请求。
                minimum_interval = random.uniform(0.8, 1.6)
                elapsed = time.monotonic() - self._last_attendance_request_at
                if elapsed < minimum_interval:
                    time.sleep(minimum_interval - elapsed)
                self._last_attendance_request_at = time.monotonic()
                response = self.session.get(
                    f"{BASE_URL}/{path}",
                    params=params,
                    headers={
                        "Accept": "application/json, text/javascript, */*; q=0.01",
                        "Referer": f"{BASE_URL}/",
                        "User-Agent": USER_AGENT,
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    timeout=20,
                )
                if response.status_code != 429:
                    break
                retry_after = response.headers.get("Retry-After", "")
                try:
                    wait_seconds = float(retry_after)
                except ValueError:
                    wait_seconds = (2 ** retry) * 3 + random.uniform(0.5, 1.5)
                time.sleep(max(1.0, min(wait_seconds, 30.0)))
            assert response is not None
            response.raise_for_status()
            result = self._json(response)
            self._attendance_cache[cache_key] = result
            return result
        except requests.Timeout as exc:
            raise EduBossError(f"读取课次 {ref_course_id} 的出勤数据超时") from exc
        except requests.RequestException as exc:
            raise EduBossError(
                f"读取课次 {ref_course_id} 的出勤数据失败：{exc}"
            ) from exc


class CourseApp:
    def __init__(self, root: Tk) -> None:
        self.integrated = "--integrated" in sys.argv
        self.root = root
        self.login_icon_image = self._load_scaled_image(LOGIN_ICON_FILE, 48)
        self.avatar_icon_image = self._load_scaled_image(AVATAR_ICON_FILE, 44)
        self.client = EduBossClient()
        self.credential_store = CredentialStore()
        self.login_history = self.credential_store.load()
        self.account = StringVar()
        self.password = StringVar()
        self.save_credentials = BooleanVar(value=False)
        default_start, default_end = self._week_range()
        self.start_date = StringVar(value=default_start.isoformat())
        self.end_date = StringVar(value=default_end.isoformat())
        self.date_range = StringVar(
            value=f"{default_start.isoformat()}  →  {default_end.isoformat()}"
        )

        root.title("课程数据工具")
        self._set_icon(root)
        self._set_window(500, 520)
        root.resizable(False, False)
        root.configure(bg="#f3f6fc")
        self.history_list_font = Font(
            root=root, family="Microsoft YaHei UI", size=13
        )
        root.option_add("*TCombobox*Listbox.font", self.history_list_font)
        style = Style()
        style.configure(
            "Modern.TCombobox", padding=8, font=("Microsoft YaHei UI", 11),
            fieldbackground="#f8faff", background="white"
        )
        self._show_login()

    @staticmethod
    def _load_scaled_image(path: Path, target_size: int) -> PhotoImage:
        image = PhotoImage(file=str(path))
        largest_side = max(image.width(), image.height())
        factor = max(1, (largest_side + target_size - 1) // target_size)
        return image.subsample(factor, factor) if factor > 1 else image

    def _set_window(self, width: int, height: int) -> None:
        self.root.update_idletasks()
        x = max(0, (self.root.winfo_screenwidth() - width) // 2)
        y = max(0, (self.root.winfo_screenheight() - height) // 2)
        self.root.geometry(f"{width}x{height}+{x}+{y}")

    @staticmethod
    def _set_icon(window: Any) -> None:
        """统一主窗口、子窗口及其消息弹窗的标题栏图标。"""
        try:
            window.iconbitmap(default=str(ICON_FILE))
        except Exception:
            # 图标缺失时不影响程序核心功能。
            pass

    @staticmethod
    def _add_hover(button: Button, normal: str, hover: str) -> None:
        button.bind("<Enter>", lambda _event: button.configure(bg=hover))
        button.bind("<Leave>", lambda _event: button.configure(bg=normal))

    def _clear(self) -> None:
        for child in self.root.winfo_children():
            child.destroy()

    def _show_login(self) -> None:
        self._clear()
        self.root.configure(bg="#f3f6fc")
        panel = Frame(self.root, bg="white", padx=44, pady=28, highlightthickness=0)
        panel.pack(fill=BOTH, expand=True, padx=50, pady=32)
        login_header = Frame(panel, bg="white")
        login_header.pack(fill="x", pady=(0, 24))
        logo = Label(login_header, image=self.login_icon_image, bg="white", bd=0)
        logo.pack(side=LEFT, padx=(0, 13))
        title_box = Frame(login_header, bg="white")
        title_box.pack(side=LEFT)
        Label(title_box, text="欢迎登录", bg="white", fg="#172033",
              font=("Microsoft YaHei UI", 17, "bold")).pack(anchor="w")
        Label(title_box, text="课程数据助手", bg="white", fg="#8995aa",
              font=("Microsoft YaHei UI", 8)).pack(anchor="w", pady=(2, 0))
        Label(panel, text="账号", bg="white", fg="#3d4960", anchor="w",
              font=("Microsoft YaHei UI", 9)).pack(fill="x")
        account_entry = Combobox(
            panel, textvariable=self.account, values=list(self.login_history),
            font=("Microsoft YaHei UI", 11), state="normal", style="Modern.TCombobox"
        )
        account_entry.pack(fill="x", pady=(7, 17))
        account_entry.bind("<<ComboboxSelected>>", self._select_history_account)
        Label(panel, text="密码", bg="white", fg="#3d4960", anchor="w",
              font=("Microsoft YaHei UI", 9)).pack(fill="x")
        password_entry = Entry(
            panel, textvariable=self.password, show="●", font=("Microsoft YaHei UI", 11),
            relief="flat", bd=0, highlightthickness=1, bg="#f8faff",
            highlightbackground="#dfe5f1", highlightcolor="#526ff5"
        )
        password_entry.pack(fill="x", ipady=9, pady=(7, 12))
        Checkbutton(
            panel, text="保存账号和密码", variable=self.save_credentials,
            bg="white", fg="#657189", activebackground="white",
            activeforeground="#3348a5", selectcolor="white", cursor="hand2",
            font=("Microsoft YaHei UI", 9), bd=0, highlightthickness=0
        ).pack(anchor="w", pady=(0, 20))
        self.login_button = Button(
            panel,
            text="登录",
            command=self._login,
            bg="#526ff5",
            fg="white",
            activebackground="#405ddd",
            activeforeground="white",
            relief="flat",
            cursor="hand2",
            bd=0,
            font=("Microsoft YaHei UI", 11, "bold"),
        )
        self.login_button.pack(fill="x", ipady=10)
        self._add_hover(self.login_button, "#526ff5", "#405ddd")
        Label(panel, text="登录信息将使用 Windows 安全加密", bg="white", fg="#a0aabc",
              font=("Microsoft YaHei UI", 8)).pack(pady=(16, 0))
        password_entry.bind("<Return>", lambda _event: self._login())
        account_entry.focus_set()

    def _select_history_account(self, _event: Any = None) -> None:
        saved_password = self.login_history.get(self.account.get())
        if saved_password is not None:
            self.password.set(saved_password)
            self.save_credentials.set(True)

    def _login(self) -> None:
        account = self.account.get().strip()
        password = self.password.get()
        if not account or not password:
            messagebox.showwarning("提示", "请输入账号和密码", parent=self.root)
            return
        self.login_button.configure(state="disabled", text="登录中…")

        def work() -> None:
            try:
                self.client.login(account, password)
            except Exception as exc:  # 后台线程中的错误统一交给主线程显示
                self.root.after(0, lambda: self._login_failed(str(exc)))
            else:
                self.root.after(0, lambda: self._login_succeeded(account, password))

        threading.Thread(target=work, daemon=True).start()

    def _login_failed(self, message: str) -> None:
        self.login_button.configure(state="normal", text="登录")
        messagebox.showerror("登录失败", message, parent=self.root)

    def _login_succeeded(self, account: str, password: str) -> None:
        if self.save_credentials.get():
            self.login_history[account] = password
        else:
            self.login_history.pop(account, None)
        try:
            self.credential_store.save(self.login_history)
        except OSError as exc:
            messagebox.showwarning(
                "保存失败", f"登录成功，但无法保存登录历史：{exc}", parent=self.root
            )
        self._show_actions()

    def _show_actions(self) -> None:
        self.password.set("")
        self._clear()
        self.root.title(f"课程数据工具 - {self.client.teacher_name}")
        self._set_window(540, 570)
        self.root.configure(bg="#f3f6fc")
        panel = Frame(self.root, bg="white", padx=40, pady=32, highlightthickness=0)
        panel.pack(fill=BOTH, expand=True, padx=40, pady=34)
        heading = Frame(panel, bg="white")
        heading.pack(fill="x")
        avatar = Label(heading, image=self.avatar_icon_image, bg="white", bd=0)
        avatar.pack(side=LEFT, padx=(0, 12))
        user_text = Frame(heading, bg="white")
        user_text.pack(side=LEFT)
        Label(user_text, text=self.client.teacher_name, bg="white", fg="#172033",
              font=("Microsoft YaHei UI", 14, "bold")).pack(anchor="w")
        Label(user_text, text="课程数据已就绪", bg="white", fg="#8793a8",
              font=("Microsoft YaHei UI", 8)).pack(anchor="w", pady=(2, 0))
        logout_button = Button(
            heading, text="退出登录", command=self._logout, bg="#fff1f2", fg="#d44b5e",
            activebackground="#ffe4e7", activeforeground="#bd3147", relief="flat",
            bd=0, cursor="hand2", font=("Microsoft YaHei UI", 9), padx=12, pady=6
        )
        logout_button.pack(side="right")
        self._add_hover(logout_button, "#fff1f2", "#ffe4e7")
        Label(panel, text="选择日期范围", bg="white", fg="#3d4960",
              font=("Microsoft YaHei UI", 10, "bold")).pack(anchor="w", pady=(27, 9))
        dates = Frame(panel, bg="#f6f8ff", padx=14, pady=11,
                      highlightthickness=1, highlightbackground="#e1e6f7")
        dates.pack(fill="x", pady=(0, 25))
        Label(dates, text="课表起点  →  课表终点", bg="#f6f8ff", fg="#8a96ac",
              font=("Microsoft YaHei UI", 8)).pack(anchor="w", pady=(0, 4))
        date_range_button = Button(
            dates, textvariable=self.date_range,
            command=self._open_date_picker,
            bg="#f6f8ff", fg="#3148b0", activebackground="#e9edff",
            activeforeground="#283d99", relief="flat", bd=0, cursor="hand2",
            anchor="w", font=("Microsoft YaHei UI", 12, "bold")
        )
        date_range_button.pack(fill="x", ipady=4)
        self._add_hover(date_range_button, "#f6f8ff", "#e9edff")
        buttons = Frame(panel, bg="white")
        buttons.pack(fill="x")
        self.basic_copy_button = Button(
            buttons,
            text="复制基础信息",
            command=lambda: self._load_courses("copy_basic"),
            bg="#eef8f3",
            fg="#267451",
            activebackground="#dff1e8",
            activeforeground="#1f6143",
            relief="flat",
            cursor="hand2",
            bd=0,
            font=("Microsoft YaHei UI", 10, "bold"),
        )
        self.basic_copy_button.pack(side=LEFT, fill="x", expand=True, ipady=12, padx=(0, 8))
        self.export_button = Button(
            buttons,
            text="导出为 Text",
            command=lambda: self._load_courses("export"),
            bg="#edf1ff",
            fg="#3f57c8",
            activebackground="#dfe6ff",
            activeforeground="#3048b5",
            relief="flat",
            cursor="hand2",
            bd=0,
            font=("Microsoft YaHei UI", 10, "bold"),
        )
        self.export_button.pack(side=LEFT, fill="x", expand=True, ipady=12, padx=(8, 0))
        self._add_hover(self.basic_copy_button, "#eef8f3", "#dff1e8")
        self._add_hover(self.export_button, "#edf1ff", "#dfe6ff")
        self.copy_button = Button(
            panel,
            text="导入到课表" if self.integrated else "复制课程考勤数据",
            command=lambda: self._load_courses("integrate" if self.integrated else "copy"),
            bg="#526ff5",
            fg="white",
            activebackground="#405ddd",
            activeforeground="white",
            relief="flat",
            cursor="hand2",
            bd=0,
            font=("Microsoft YaHei UI", 10, "bold"),
        )
        self.copy_button.pack(fill="x", ipady=10, pady=(12, 0))
        self._add_hover(self.copy_button, "#526ff5", "#405ddd")
        self.course_progress = Progressbar(
            panel, mode="determinate", maximum=1, value=0
        )
        self.course_progress.pack(fill="x", pady=(20, 0))
        self.course_progress_text = StringVar(value="等待读取课程")
        Label(
            panel,
            textvariable=self.course_progress_text,
            bg="white",
            fg="#718096",
            font=("Microsoft YaHei UI", 9),
        ).pack(anchor="w", pady=(7, 0))

    def _logout(self) -> None:
        self.client.session.close()
        self.client = EduBossClient()
        self.password.set("")
        self.save_credentials.set(False)
        self.root.title("课程数据工具")
        self._set_window(500, 520)
        self._show_login()

    @staticmethod
    def _week_range() -> tuple[date, date]:
        today = date.today()
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)

    def _open_date_picker(self) -> None:
        """在同一个月历中依次选择起点和终点。"""
        try:
            current_start = date.fromisoformat(self.start_date.get())
            current_end = date.fromisoformat(self.end_date.get())
        except ValueError:
            current_start = current_end = date.today()

        picker = Toplevel(self.root)
        picker.title("选择日期范围")
        self._set_icon(picker)
        picker.configure(bg="white")
        picker.resizable(False, False)
        picker.transient(self.root)
        picker.grab_set()

        state = {
            "year": current_start.year,
            "month": current_start.month,
            "pending_start": None,
        }
        header = Frame(picker, bg="white", padx=14, pady=12)
        header.pack(fill="x")
        month_label = Label(header, bg="white", fg="#172033",
                            font=("Microsoft YaHei UI", 12, "bold"))
        month_label.pack(side=LEFT, expand=True)
        days_frame = Frame(picker, bg="white", padx=12, pady=8)
        days_frame.pack(fill=BOTH, expand=True)
        hint = Label(
            picker, text="请先点击起点日期", bg="#f5f7ff", fg="#4f63b7",
            font=("Microsoft YaHei UI", 9), pady=9
        )
        hint.pack(fill="x")

        def move_month(step: int) -> None:
            month = state["month"] + step
            year = state["year"]
            if month == 0:
                year, month = year - 1, 12
            elif month == 13:
                year, month = year + 1, 1
            state.update(year=year, month=month)
            render()

        prev_button = Button(header, text="‹", command=lambda: move_month(-1),
                             bg="white", fg="#4f6ef7", activebackground="#edf1ff",
                             relief="flat", bd=0, cursor="hand2",
                             font=("Microsoft YaHei UI", 16, "bold"), width=3)
        prev_button.pack(side=LEFT, before=month_label)
        next_button = Button(header, text="›", command=lambda: move_month(1),
                             bg="white", fg="#4f6ef7", activebackground="#edf1ff",
                             relief="flat", bd=0, cursor="hand2",
                             font=("Microsoft YaHei UI", 16, "bold"), width=3)
        next_button.pack(side=LEFT)

        def choose(day_number: int) -> None:
            chosen = date(state["year"], state["month"], day_number)
            if state["pending_start"] is None:
                state["pending_start"] = chosen
                hint.configure(text=f"起点 {chosen.isoformat()}，请点击终点日期")
                render()
                return
            start = state["pending_start"]
            end = chosen
            if end < start:
                start, end = end, start
            self.start_date.set(start.isoformat())
            self.end_date.set(end.isoformat())
            self.date_range.set(f"{start.isoformat()}  →  {end.isoformat()}")
            picker.destroy()

        def render() -> None:
            for child in days_frame.winfo_children():
                child.destroy()
            month_label.configure(text=f'{state["year"]} 年 {state["month"]} 月')
            for column, weekday in enumerate(("一", "二", "三", "四", "五", "六", "日")):
                Label(days_frame, text=weekday, bg="white", fg="#8a96aa",
                      font=("Microsoft YaHei UI", 9), width=4).grid(
                          row=0, column=column, padx=2, pady=(0, 6)
                      )
            weeks = calendar.Calendar(firstweekday=0).monthdayscalendar(
                state["year"], state["month"]
            )
            for row, week in enumerate(weeks, start=1):
                for column, day_number in enumerate(week):
                    if day_number == 0:
                        Label(days_frame, text="", bg="white", width=4).grid(
                            row=row, column=column, padx=2, pady=2
                        )
                        continue
                    cell_date = date(state["year"], state["month"], day_number)
                    pending = state["pending_start"]
                    if pending is None:
                        is_endpoint = cell_date in (current_start, current_end)
                        is_in_range = current_start <= cell_date <= current_end
                    else:
                        is_endpoint = cell_date == pending
                        is_in_range = False
                    background = (
                        "#4f6ef7" if is_endpoint
                        else "#e8edff" if is_in_range
                        else "white"
                    )
                    foreground = "white" if is_endpoint else "#334155"
                    day_button = Button(
                        days_frame, text=str(day_number),
                        command=lambda day_value=day_number: choose(day_value),
                        bg=background, fg=foreground,
                        activebackground="#dfe6ff", activeforeground="#263b92",
                        relief="flat", bd=0, cursor="hand2", width=4,
                        font=("Microsoft YaHei UI", 9),
                    )
                    day_button.grid(row=row, column=column, padx=2, pady=2, ipady=4)

        render()
        picker.update_idletasks()
        x = self.root.winfo_rootx() + (self.root.winfo_width() - picker.winfo_width()) // 2
        y = self.root.winfo_rooty() + (self.root.winfo_height() - picker.winfo_height()) // 2
        picker.geometry(f"+{max(0, x)}+{max(0, y)}")

    @staticmethod
    def _simplify_courses(
        raw_data: Any, attendance_data: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """把接口响应整理成稳定、便于复制使用的课程数组。"""

        def first(item: dict[str, Any], *keys: str, default: Any = "") -> Any:
            for key in keys:
                value = item.get(key)
                if value is not None and value != "":
                    return value
            return default

        def object_name(value: Any) -> str:
            if isinstance(value, dict):
                return str(first(value, "name", "subjectName", "gradeName"))
            return str(value or "")

        def anonymous_student_id(original_id: Any, student_name: Any) -> str:
            """同一姓名和原 ID 始终映射为同一个、不暴露原值的 ID。"""
            source = f"course-student-v1\0{student_name}\0{original_id}"
            digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
            return f"stu_{digest[:16]}"

        def attendance_rows(value: Any) -> list[dict[str, Any]]:
            rows: list[dict[str, Any]] = []
            if isinstance(value, dict):
                if ("studentId" in value or "studentName" in value) and any(
                    key in value
                    for key in (
                        "courseStatus",
                        "miniClassAttendanceStatus",
                        "attendanceDetailStatusName",
                        "realHours",
                        "changeHours",
                    )
                ):
                    rows.append(value)
                else:
                    for child in value.values():
                        rows.extend(attendance_rows(child))
            elif isinstance(value, list):
                for child in value:
                    rows.extend(attendance_rows(child))
            return rows

        def number(value: Any) -> float | None:
            if value is None or value == "":
                return None
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        def attendance_values(
            course_type: str, detail: dict[str, Any], start_time: str
        ) -> dict[str, Any]:
            status = str(
                first(
                    detail,
                    "attendanceDetailStatusName",
                    "courseStatusName",
                    "miniClassAttendanceStatusName",
                    "courseStatus",
                    "miniClassAttendanceStatus",
                )
            )
            status_code = " ".join(
                str(detail.get(key) or "")
                for key in (
                    "courseStatus",
                    "miniClassAttendanceStatus",
                    "attendanceDetailStatusName",
                )
            ).upper()
            is_leave = "假" in status or "LEAVE" in status_code

            if is_leave:
                actual_course_hours: float | None = 0.0
            elif course_type == "SMALL_CLASS":
                actual_course_hours = number(detail.get("changeHours"))
                if (
                    actual_course_hours is None
                    and detail.get("miniClassAttendanceStatus") == "ATTENDANCE"
                ):
                    actual_course_hours = number(detail.get("courseHours"))
            else:
                actual_course_hours = None
                for key in (
                    "realHours",
                    "auditHours",
                    "teachingManagerAuditHours",
                    "staduyManagerAuditHours",
                ):
                    actual_course_hours = number(detail.get(key))
                    if actual_course_hours is not None:
                        break

            actual_minutes = (
                round(actual_course_hours * 40)
                if actual_course_hours is not None
                else None
            )
            actual_time = None
            if actual_minutes and re.fullmatch(r"\d{1,2}:\d{2}", start_time):
                start_value = datetime.strptime(start_time, "%H:%M")
                end_value = start_value + timedelta(minutes=actual_minutes)
                actual_time = (
                    f"{start_value.strftime('%H:%M')}-{end_value.strftime('%H:%M')}"
                )
            return {
                "isLeave": is_leave,
                "attendanceStatus": status,
                "actualCourseHours": actual_course_hours,
                "actualMinutes": actual_minutes,
                "actualHours": (
                    round(actual_minutes / 60, 2)
                    if actual_minutes is not None
                    else None
                ),
                "actualCourseTime": actual_time,
            }

        def find_courses(value: Any) -> list[dict[str, Any]]:
            if isinstance(value, list):
                candidates = [item for item in value if isinstance(item, dict)]
                if candidates and any(
                    any(key in item for key in ("courseDate", "courseTime", "startTime"))
                    for item in candidates
                ):
                    return candidates
                for item in value:
                    found = find_courses(item)
                    if found:
                        return found
            elif isinstance(value, dict):
                # 常见接口包装字段优先，避免误把 students 数组当成课程。
                for key in ("data", "rows", "list", "courseList", "result"):
                    if key in value:
                        found = find_courses(value[key])
                        if found:
                            return found
                for child in value.values():
                    found = find_courses(child)
                    if found:
                        return found
            return []

        simplified: list[dict[str, Any]] = []
        for course in find_courses(raw_data):
            course_type = str(first(course, "type", "courseType", "classType"))
            ref_course_id = str(first(course, "refCourseId", "courseId", "id"))
            course_start_time = str(first(course, "courseTime", "startTime"))
            details = attendance_rows((attendance_data or {}).get(ref_course_id))
            details_by_id = {
                str(first(detail, "studentId", "id", "userId")): detail
                for detail in details
                if first(detail, "studentId", "id", "userId") != ""
            }
            raw_students = first(
                course,
                "students",
                "studentList",
                "courseStudents",
                "miniClassStudentList",
                default=[],
            )
            students: list[dict[str, str]] = []
            if isinstance(raw_students, list):
                for student in raw_students:
                    if not isinstance(student, dict):
                        continue
                    original_id = first(student, "id", "studentId", "userId")
                    student_name = first(
                        student, "name", "studentName", "userName"
                    )
                    student_result: dict[str, Any] = {
                        "id": anonymous_student_id(original_id, student_name),
                        "name": str(student_name),
                    }
                    detail = details_by_id.get(str(original_id))
                    if detail is None and len(details) == 1 and len(raw_students) == 1:
                        detail = details[0]
                    if detail is not None:
                        student_result.update(
                            attendance_values(course_type, detail, course_start_time)
                        )
                    students.append(student_result)

            subject_value = first(course, "subject", "subjectName")
            grade_value = first(course, "grade", "gradeName")
            simplified.append(
                {
                    "type": course_type,
                    "courseDate": str(first(course, "courseDate", "date")),
                    "courseTime": str(first(course, "courseTime", "startTime")),
                    "courseEndTime": str(
                        first(course, "courseEndTime", "endTime")
                    ),
                    "subject": {"name": object_name(subject_value)},
                    "grade": {"name": object_name(grade_value)},
                    "students": students,
                }
            )
        return simplified

    def _load_courses(self, action: str) -> None:
        try:
            start = date.fromisoformat(self.start_date.get().strip())
            end = date.fromisoformat(self.end_date.get().strip())
        except ValueError:
            messagebox.showwarning(
                "日期格式错误", "日期请按 YYYY-MM-DD 格式填写，例如 2026-07-19",
                parent=self.root,
            )
            return
        if start > end:
            messagebox.showwarning(
                "日期范围错误", "开始日期不能晚于结束日期", parent=self.root
            )
            return
        self.root.configure(cursor="watch")
        self.copy_button.configure(state="disabled")
        self.export_button.configure(state="disabled")
        self.basic_copy_button.configure(state="disabled")
        self.course_progress.configure(mode="indeterminate")
        self.course_progress.start(12)
        self.course_progress_text.set("正在读取课程列表…")

        def work() -> None:
            try:
                self.client.begin_attendance_sync()
                data = self.client.get_courses(start, end)
                attendance_data: dict[str, Any] = {}
                courses = self._find_courses_for_attendance(data)
                total = len(courses)
                if action != "copy_basic":
                    self.root.after(0, lambda: self._begin_attendance_progress(total))
                    for index, course in enumerate(courses, start=1):
                        course_type = str(
                            course.get("type")
                            or course.get("courseType")
                            or course.get("classType")
                            or ""
                        )
                        ref_course_id = str(
                            course.get("refCourseId")
                            or course.get("courseId")
                            or course.get("id")
                            or ""
                        )
                        if ref_course_id and course_type in (
                            "SMALL_CLASS",
                            "ONE_ON_ONE_COURSE",
                        ):
                            attendance_data[ref_course_id] = (
                                self.client.get_course_attendance(
                                    course_type, ref_course_id
                                )
                            )
                        self.root.after(
                            0,
                            lambda current=index, count=total: self._set_course_progress(
                                current, count
                            ),
                        )
                simplified = self._simplify_courses(data, attendance_data)
                text = json.dumps(simplified, ensure_ascii=False, indent=2)
            except Exception as exc:
                message = str(exc)
                self.root.after(0, lambda value=message: self._course_failed(value))
            else:
                self.root.after(
                    0,
                    lambda: self._finish_action(
                        action, text, start, end, len(simplified)
                    ),
                )

        threading.Thread(target=work, daemon=True).start()

    def _begin_attendance_progress(self, total: int) -> None:
        self.course_progress.stop()
        self.course_progress.configure(
            mode="determinate", maximum=max(1, total), value=0
        )
        self.course_progress_text.set(
            f"共 {total} 节课，正在读取学生考勤…" if total else "没有查询到课程"
        )

    def _set_course_progress(self, current: int, total: int) -> None:
        self.course_progress.configure(value=current)
        self.course_progress_text.set(f"正在读取第 {current}/{total} 节课的考勤…")

    @staticmethod
    def _find_courses_for_attendance(value: Any) -> list[dict[str, Any]]:
        if isinstance(value, list):
            candidates = [item for item in value if isinstance(item, dict)]
            if candidates and any(
                "courseDate" in item and ("type" in item or "courseType" in item)
                for item in candidates
            ):
                return candidates
            for item in value:
                found = CourseApp._find_courses_for_attendance(item)
                if found:
                    return found
        elif isinstance(value, dict):
            for key in ("data", "rows", "list", "courseList", "result"):
                if key in value:
                    found = CourseApp._find_courses_for_attendance(value[key])
                    if found:
                        return found
            for child in value.values():
                found = CourseApp._find_courses_for_attendance(child)
                if found:
                    return found
        return []

    def _course_failed(self, message: str) -> None:
        self.root.configure(cursor="")
        self.course_progress.stop()
        self.copy_button.configure(state="normal")
        self.export_button.configure(state="normal")
        self.basic_copy_button.configure(state="normal")
        self.course_progress_text.set("读取失败")
        messagebox.showerror("操作失败", message, parent=self.root)

    def _finish_action(
        self, action: str, text: str, start: date, end: date, course_count: int
    ) -> None:
        self.root.configure(cursor="")
        self.course_progress.stop()
        self.copy_button.configure(state="normal")
        self.export_button.configure(state="normal")
        self.basic_copy_button.configure(state="normal")
        self.course_progress.configure(
            mode="determinate", maximum=max(1, course_count), value=course_count
        )
        self.course_progress_text.set(f"读取完成，共 {course_count} 节课")
        if action == "integrate":
            encoded = base64.b64encode(text.encode("utf-8")).decode("ascii")
            print(f"COURSE_DATA:{encoded}", flush=True)
            messagebox.showinfo("完成", "课程数据已直接发送到课表。", parent=self.root)
            self.root.destroy()
            return
        if action in ("copy", "copy_basic"):
            self.root.clipboard_clear()
            self.root.clipboard_append(text)
            self.root.update_idletasks()
            message = (
                "课程基础信息已复制到剪贴板（未查询考勤）"
                if action == "copy_basic"
                else "课程数据已复制到剪贴板"
            )
            messagebox.showinfo("完成", message, parent=self.root)
            return

        safe_name = re.sub(r'[\\/:*?"<>|\r\n]+', "_", self.client.teacher_name).strip(" ._")
        safe_name = safe_name or "老师"
        filename = f"{safe_name}_{start.isoformat()}-{end.isoformat()}.txt"
        path = filedialog.asksaveasfilename(
            parent=self.root,
            title="导出课程数据",
            initialfile=filename,
            defaultextension=".txt",
            filetypes=[("Text 文件", "*.txt")],
        )
        if not path:
            return
        try:
            Path(path).write_text(text, encoding="utf-8-sig")
        except OSError as exc:
            messagebox.showerror("导出失败", str(exc), parent=self.root)
            return
        messagebox.showinfo("完成", f"已导出到：\n{path}", parent=self.root)


def _emit_bridge_event(payload: dict[str, Any]) -> None:
    encoded = base64.b64encode(
        json.dumps(payload, ensure_ascii=False).encode("utf-8")
    ).decode("ascii")
    print(f"COURSE_SYNC:{encoded}", flush=True)


def bridge_main() -> None:
    """无界面长连接：登录与同步分离，并允许中途停止。"""
    client = EduBossClient()
    stop_event = threading.Event()
    sync_thread: threading.Thread | None = None

    def synchronize(request: dict[str, Any]) -> None:
        try:
            start = date.fromisoformat(str(request.get("startDate") or ""))
            end = date.fromisoformat(str(request.get("endDate") or ""))
            if start > end:
                raise EduBossError("开始日期不能晚于结束日期")
            # The bridge can remain logged in across days. Attendance changes
            # after roll call, so responses from a previous run are stale.
            client.begin_attendance_sync()
            raw_data = client.get_courses(start, end)
            basic_courses = CourseApp._simplify_courses(raw_data, {})
            if request.get("checkOnly"):
                _emit_bridge_event({"type": "check-basic", "courses": basic_courses})
            elif not request.get("attendanceOnly"):
                _emit_bridge_event({"type": "basic", "courses": basic_courses})
            supported = []
            for course in CourseApp._find_courses_for_attendance(raw_data):
                course_type = str(course.get("type") or course.get("courseType") or course.get("classType") or "")
                ref_id = str(course.get("refCourseId") or course.get("courseId") or course.get("id") or "")
                if ref_id and course_type in ("SMALL_CLASS", "ONE_ON_ONE_COURSE"):
                    supported.append((course, course_type, ref_id))
            total = len(supported)
            for index, (course, course_type, ref_id) in enumerate(supported, start=1):
                if stop_event.is_set():
                    _emit_bridge_event({"type": "stopped", "current": index - 1, "total": total})
                    return
                _emit_bridge_event({
                    "type": "check-progress" if request.get("checkOnly") else "progress",
                    "current": index,
                    "total": total,
                })
                attendance = client.get_course_attendance(course_type, ref_id)
                cleaned = CourseApp._simplify_courses([course], {ref_id: attendance})
                if cleaned:
                    _emit_bridge_event({
                        "type": "check-attendance" if request.get("checkOnly") else "attendance",
                        "course": cleaned[0],
                        "current": index,
                        "total": total,
                    })
            _emit_bridge_event({
                "type": "check-done" if request.get("checkOnly") else "done",
                "total": total,
            })
        except Exception as exc:
            _emit_bridge_event({"type": "error", "message": str(exc)})

    for line in sys.stdin:
        try:
            request = json.loads(line)
            action = request.get("action")
            if action == "login":
                account = str(request.get("account") or "").strip()
                password = str(request.get("password") or "")
                if not account or not password:
                    raise EduBossError("请输入账号和密码")
                client.login(account, password)
                try:
                    CredentialStore().save(
                        {account: password} if request.get("savePassword") else {}
                    )
                except OSError:
                    pass
                _emit_bridge_event({"type": "login", "teacherName": client.teacher_name})
            elif action == "restore":
                saved = CredentialStore().load()
                if not saved:
                    _emit_bridge_event({"type": "restore-missing"})
                    continue
                account, password = next(reversed(saved.items()))
                client.login(account, password)
                _emit_bridge_event({"type": "login", "teacherName": client.teacher_name, "restored": True})
            elif action == "sync":
                if not client.teacher_id:
                    raise EduBossError("请先登录")
                if sync_thread and sync_thread.is_alive():
                    raise EduBossError("同步正在进行中")
                stop_event.clear()
                sync_thread = threading.Thread(target=synchronize, args=(request,), daemon=True)
                sync_thread.start()
            elif action == "stop":
                stop_event.set()
                _emit_bridge_event({"type": "stopping"})
            elif action == "logout":
                stop_event.set()
                CredentialStore().save({})
                client.session.close()
                client = EduBossClient()
                _emit_bridge_event({"type": "logged-out"})
        except Exception as exc:
            _emit_bridge_event({"type": "error", "message": str(exc)})


def main() -> None:
    if "--bridge" in sys.argv:
        bridge_main()
        return
    root = Tk()
    # 避免 Tk 默认空白窗口在完整界面创建前短暂显示。
    root.withdraw()
    CourseApp(root)
    root.deiconify()
    root.lift()
    root.focus_force()
    root.mainloop()


if __name__ == "__main__":
    main()
