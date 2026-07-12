from io import BytesIO
import pandas as pd

def dataframe_to_xlsx(dataframe: pd.DataFrame) -> bytes:
    output = BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        dataframe.to_excel(writer, index=False, sheet_name="Data")
        worksheet = writer.sheets["Data"]
        worksheet.freeze_panes(1, 0)
        worksheet.autofilter(0, 0, len(dataframe), max(len(dataframe.columns) - 1, 0))
    return output.getvalue()
