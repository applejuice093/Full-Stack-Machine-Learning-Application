import pytest

from app.core.storage import is_valid_id
from app.training.store import load_table
from app.training.train import TrainError, predict_row
from app.visualization.plots import load_evaluation_figures

VALID = "0123456789abcdef0123456789abcdef"


@pytest.mark.parametrize(
    "value",
    ["", "abc", VALID.upper(), VALID + "0", "../" + VALID[3:], VALID[:-1] + "/"],
)
def test_is_valid_id_rejects_non_ids(value):
    assert not is_valid_id(value)


def test_is_valid_id_accepts_uuid_hex():
    assert is_valid_id(VALID)


def test_loaders_reject_path_like_ids():
    with pytest.raises(FileNotFoundError):
        load_table("../../etc/passwd")
    with pytest.raises(FileNotFoundError):
        load_evaluation_figures("../models")
    with pytest.raises(TrainError):
        predict_row("../models", {})
