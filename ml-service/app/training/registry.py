from __future__ import annotations

from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

CLASSIFICATION = {
    "logistic_regression",
    "decision_tree",
    "random_forest",
    "knn",
    "naive_bayes",
    "svm",
}
REGRESSION = {
    "linear_regression",
    "polynomial_regression",
    "decision_tree_regressor",
    "random_forest_regressor",
    "svr",
}


def model_task(model_id: str) -> str:
    if model_id in CLASSIFICATION:
        return "classification"
    if model_id in REGRESSION:
        return "regression"
    raise KeyError(model_id)


def estimator(model_id: str):
    builders = {
        "logistic_regression": lambda: LogisticRegression(max_iter=400),
        "decision_tree": lambda: DecisionTreeClassifier(random_state=0),
        "random_forest": lambda: RandomForestClassifier(random_state=0),
        "knn": lambda: KNeighborsClassifier(),
        "naive_bayes": lambda: GaussianNB(),
        "svm": lambda: SVC(probability=True),
        "linear_regression": lambda: LinearRegression(),
        "polynomial_regression": lambda: LinearRegression(),
        "decision_tree_regressor": lambda: DecisionTreeRegressor(random_state=0),
        "random_forest_regressor": lambda: RandomForestRegressor(random_state=0),
        "svr": lambda: SVR(),
    }
    return builders[model_id]()


def default_search(model_id: str) -> str:
    if model_id in {"svm", "svr"}:
        return "random"
    return "grid"


def search_space(model_id: str, feature_count: int) -> dict:
    spaces = {
        "logistic_regression": {"model__C": [0.1, 1.0, 10.0]},
        "decision_tree": {
            "model__max_depth": [3, 5, None],
            "model__min_samples_split": [2, 4],
        },
        "random_forest": {
            "model__n_estimators": [20, 40],
            "model__max_depth": [3, None],
        },
        "knn": {
            "model__n_neighbors": [3, 5],
            "model__weights": ["uniform", "distance"],
        },
        "naive_bayes": {"model__var_smoothing": [1e-9, 1e-8]},
        "svm": {
            "model__C": [0.1, 1.0],
            "model__kernel": ["linear", "rbf"],
        },
        "linear_regression": {"model__fit_intercept": [True, False]},
        "polynomial_regression": {
            "model__poly__degree": [2, 3] if feature_count <= 6 else [2],
            "model__reg__fit_intercept": [True, False],
        },
        "decision_tree_regressor": {
            "model__max_depth": [3, 5, None],
            "model__min_samples_split": [2, 4],
        },
        "random_forest_regressor": {
            "model__n_estimators": [20, 40],
            "model__max_depth": [3, None],
        },
        "svr": {
            "model__C": [0.1, 1.0],
            "model__epsilon": [0.1, 0.2],
        },
    }
    return spaces[model_id]
