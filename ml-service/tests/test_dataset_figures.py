import numpy as np
import pandas as pd

from app.visualization.plots import MAX_DISTRIBUTION_COLUMNS, dataset_figures


def test_small_dataset_has_every_chart():
    frame = pd.DataFrame(
        {
            "rooms": ["3", "2", "4", "3", "1"],
            "city": ["a", "b", "a", "", "c"],
            "price": ["310", "198", "540", "365", "142"],
        }
    )
    figures = dataset_figures(frame)
    assert [chart["name"] for chart in figures["distributions"]] == ["rooms", "city", "price"]
    assert all(chart["image"] for chart in figures["distributions"])
    assert figures["correlation"]
    assert figures["missing"]


def test_wide_dataset_stays_small_and_complete():
    rng = np.random.default_rng(0)
    frame = pd.DataFrame(rng.normal(size=(300, 80)).round(3), columns=[f"f{i}" for i in range(80)]).astype(str)
    figures = dataset_figures(frame)
    assert len(figures["distributions"]) == MAX_DISTRIBUTION_COLUMNS
    assert figures["correlation"] and figures["missing"]
    total = sum(len(chart["image"]) for chart in figures["distributions"])
    total += len(figures["correlation"]) + len(figures["missing"])
    # Must fit comfortably under the 4.5 MB serverless response limit.
    assert total < 2_000_000
    assert any("correlation heatmap shows" in note for note in figures["notes"])
