import pandas as pd
from app.services.export_service import dataframe_to_xlsx

def test_dataframe_to_xlsx_returns_content():
    result = dataframe_to_xlsx(pd.DataFrame({"name": ["A"], "value": [1]}))
    assert result.startswith(b"PK")
