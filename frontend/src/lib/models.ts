export type TaskType = "classification" | "regression";

export type ModelOption = {
  id: string;
  name: string;
  task: TaskType;
  summary: string;
};

export const models: ModelOption[] = [
  {
    id: "logistic_regression",
    name: "Logistic regression",
    task: "classification",
    summary: "Draws a boundary between classes.",
  },
  {
    id: "decision_tree",
    name: "Decision tree",
    task: "classification",
    summary: "Splits rows with yes or no questions.",
  },
  {
    id: "random_forest",
    name: "Random forest",
    task: "classification",
    summary: "Averages many decision trees.",
  },
  {
    id: "knn",
    name: "K-nearest neighbors",
    task: "classification",
    summary: "Predicts from the nearest rows.",
  },
  {
    id: "naive_bayes",
    name: "Naive Bayes",
    task: "classification",
    summary: "Uses how often each value shows up in a class.",
  },
  {
    id: "svm",
    name: "Support vector machine",
    task: "classification",
    summary: "Separates classes with the widest gap.",
  },
  {
    id: "linear_regression",
    name: "Linear regression",
    task: "regression",
    summary: "Fits a straight line through the numbers.",
  },
  {
    id: "polynomial_regression",
    name: "Polynomial regression",
    task: "regression",
    summary: "Fits a curve using powers of each input.",
  },
  {
    id: "decision_tree_regressor",
    name: "Decision tree regressor",
    task: "regression",
    summary: "Predicts a number with piecewise splits.",
  },
  {
    id: "random_forest_regressor",
    name: "Random forest regressor",
    task: "regression",
    summary: "Averages many regression trees.",
  },
  {
    id: "svr",
    name: "Support vector regressor",
    task: "regression",
    summary: "Fits a line and ignores small errors.",
  },
];

export function modelsFor(task: TaskType): ModelOption[] {
  return models.filter((model) => model.task === task);
}
