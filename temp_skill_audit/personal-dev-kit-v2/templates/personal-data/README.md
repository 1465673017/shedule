# Personal Data Tool

适合 CSV/Excel 上传、清洗、预览和导出。

默认使用 FastAPI。根据复杂度选择：
- 简单任务：Pandas
- 大文件：Polars/PyArrow
- 新建带格式 Excel：XlsxWriter
- 修改现有 Excel：openpyxl
