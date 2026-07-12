from app.main import main

def test_main_runs(capsys):
    main()
    assert "Hello" in capsys.readouterr().out
