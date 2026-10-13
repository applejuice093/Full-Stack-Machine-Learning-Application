# Sample datasets

Small tables for smoke-testing the Bench upload → train → predict flow without bringing your own file.

## `houses.csv`

Synthetic housing rows (12 examples).

| Column | Type | Role |
|---|---|---|
| `rooms` | integer | Feature — number of rooms |
| `year_built` | integer | Feature — construction year |
| `neighborhood` | categorical | Feature — `north` / `east` / `south` / `west` |
| `lot_sqft` | integer | Feature — lot size in square feet |
| `price` | integer | **Regression target** — sale price |
| `sold` | categorical (`yes` / `no`) | **Classification target** — whether the listing sold |

Suggested drills:

1. **Regression** — target `price`, features `rooms`, `year_built`, `neighborhood`, `lot_sqft`, model `random_forest_regressor` or `linear_regression`.
2. **Classification** — target `sold`, same features (drop `price` or keep it as an input), model `logistic_regression` or `random_forest`.

The frontend ships a copy at `frontend/src/data/sample.csv` for the **Use sample table** button; keep both files in sync if you edit columns.
