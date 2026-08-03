import unittest

from main import CourseApp


class CourseSyncStudentMergeTests(unittest.TestCase):
    def test_attendance_only_student_is_added_to_course_roster(self):
        raw_courses = [{
            "id": "course-1",
            "type": "SMALL_CLASS",
            "courseDate": "2026-08-03",
            "courseTime": "10:00",
            "courseEndTime": "10:40",
            "subjectName": "数学",
            "gradeName": "三年级",
            "students": [
                {"studentId": "student-a", "studentName": "A"},
                {"studentId": "student-b", "studentName": "B"},
            ],
        }]
        attendance = {
            "course-1": {
                "rows": [
                    {
                        "studentId": "student-a",
                        "studentName": "A",
                        "miniClassAttendanceStatus": "ATTENDANCE",
                        "courseHours": 1,
                    },
                    {
                        "studentId": "student-b",
                        "studentName": "B",
                        "miniClassAttendanceStatus": "ATTENDANCE",
                        "courseHours": 1,
                    },
                    {
                        "studentId": "student-c",
                        "studentName": "C",
                        "miniClassAttendanceStatus": "ATTENDANCE",
                        "changeHours": 1.5,
                    },
                ]
            }
        }

        courses = CourseApp._simplify_courses(raw_courses, attendance)

        self.assertEqual([student["name"] for student in courses[0]["students"]], ["A", "B", "C"])
        added_student = courses[0]["students"][2]
        self.assertEqual(added_student["attendanceStatus"], "ATTENDANCE")
        self.assertEqual(added_student["actualMinutes"], 60)
        self.assertTrue(added_student["id"].startswith("stu_"))


if __name__ == "__main__":
    unittest.main()
