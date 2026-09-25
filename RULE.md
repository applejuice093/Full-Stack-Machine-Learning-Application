# RULE.md — End-to-End Machine Learning Web Application

## 1. Project Identity

**Project Title:** Design and Development of an End-to-End Machine Learning Web Application for Dataset Upload, Model Training, Prediction, and Performance Evaluation

**Primary Objective:**  
Build a production-structured full-stack Machine Learning web application that allows users to upload a CSV dataset, inspect and configure it, preprocess data, train and tune ML models, evaluate performance, save the best model, and make predictions through a web interface.

The application must be modular, maintainable, type-safe where applicable, and easy for a student/team to understand and extend.

---

# 2. Mandatory Technology Stack

The agent MUST follow this stack unless the user explicitly requests a change.

| Layer | Required Technology |
|---|---|
| Frontend | React + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express |
| Database | PostgreSQL + pgvector |
| Agent Framework | LangGraph |
| LLM Provider | Open-source models through Groq by default |
| Authentication | NextAuth/Auth module — deviation allowed only when required by the architecture |
| Deployment | Vercel + Railway |
| Observability | Langfuse — mandatory |
| ML Engine | Python + Pandas + NumPy + Scikit-learn |
| Visualization | Matplotlib + Seaborn |

### Important Architecture Rule

The Node.js/Express backend is the primary application/API backend.

ML operations MUST be implemented in a dedicated Python ML service rather than attempting to implement Scikit-learn functionality in Node.js.

Recommended communication:

```text
React Frontend
      |
      v
Node.js + Express API
      |
      +--------------------+
      |                    |
      v                    v
PostgreSQL + pgvector   Python ML Service
                            |
                            v
                    Pandas / NumPy /
                    Scikit-learn
```

LangGraph is used for agentic workflow/orchestration where an agent is required. It MUST NOT replace deterministic ML pipeline logic.

---

# 3. Core Product Requirements

The application MUST support the following workflow:

```text
User
  ↓
Authentication
  ↓
Upload CSV
  ↓
Dataset Analysis
  ↓
Select Target Variable
  ↓
Select Input Features
  ↓
Select Classification / Regression
  ↓
Select ML Algorithm
  ↓
Configure Preprocessing
  ↓
Train/Test Split
  ↓
Hyperparameter Tuning
  ↓
Find Best Model
  ↓
Evaluate Model
  ↓
Save Model
  ↓
Enter New Data
  ↓
Generate Prediction
  ↓
Display Prediction + Confidence
  ↓
View Metrics + Visualizations
```

The application MUST preserve this logical flow even if the UI implementation changes.

---

# 4. Machine Learning Requirements

## 4.1 Supported Classification Algorithms

The system MUST support:

- Logistic Regression
- Decision Tree Classifier
- Random Forest Classifier
- K-Nearest Neighbors (KNN)
- Naive Bayes
- Support Vector Machine (SVM)

## 4.2 Supported Regression Algorithms

The system MUST support:

- Linear Regression
- Polynomial Regression
- Decision Tree Regressor
- Random Forest Regressor
- Support Vector Regressor (SVR)

Do not silently remove an algorithm. If an algorithm cannot be used for a particular dataset, explain the reason to the user and provide a suitable alternative workflow.

---

# 5. Data Preprocessing Requirements

The ML pipeline MUST be reproducible and MUST perform preprocessing without data leakage.

Required preprocessing capabilities:

1. Missing value handling
2. Duplicate removal
3. Numerical feature handling
4. Categorical feature encoding
5. Feature scaling where appropriate
6. Train/test splitting
7. Hyperparameter tuning

Use Scikit-learn pipelines and transformers wherever practical.

### Data Leakage Rule

Preprocessing transformations MUST be fitted only on training data.

Do NOT:

- Scale the complete dataset before splitting.
- Calculate imputation statistics from the complete dataset before splitting.
- Encode data using information from the test set.
- Tune hyperparameters using the final test set.

Preferred structure:

```text
Raw Data
   ↓
Train/Test Split
   ↓
Preprocessing Pipeline
   ↓
Hyperparameter Search
   ↓
Best Model
   ↓
Final Test Evaluation
```

---

# 6. Dataset Upload Module

The frontend MUST allow users to upload CSV files.

After upload, display:

- Dataset filename
- Number of rows
- Number of columns
- Feature/column names
- Data types
- Sample records
- Missing-value information
- Duplicate count
- Basic dataset statistics

The backend MUST validate uploaded files.

Minimum validation:

- File exists
- File is CSV
- File is within configured size limits
- Dataset can be parsed
- Dataset contains usable columns
- Dataset is not empty

Never trust uploaded filenames or file contents.

---

# 7. Dataset Configuration

The user MUST be able to:

- Select target variable
- Select input features
- Select task:
  - Classification
  - Regression

The system should automatically provide useful information about columns, such as:

- Numeric/categorical type
- Missing values
- Unique-value count
- Possible target suitability

The system MUST NOT automatically change the user's selected target or features without informing the user.

---

# 8. Model Selection

The UI MUST show only models applicable to the selected task.

### Classification

```text
Logistic Regression
Decision Tree
Random Forest
KNN
Naive Bayes
SVM
```

### Regression

```text
Linear Regression
Polynomial Regression
Decision Tree Regressor
Random Forest Regressor
SVR
```

Each model should expose relevant hyperparameters where appropriate.

---

# 9. Hyperparameter Tuning

The system MUST support:

- Grid Search
- Random Search

The user should be able to configure or accept sensible defaults.

The system MUST record:

- Model name
- Search method
- Parameter search space
- Best parameters
- Cross-validation configuration
- Best CV score
- Training duration

Do not use the test set to select hyperparameters.

---

# 10. Evaluation Requirements

## Classification Metrics

The system MUST calculate and display:

- Accuracy
- Precision
- Recall
- F1-score
- ROC-AUC where applicable
- Confusion Matrix

Use appropriate averaging for multiclass classification and clearly indicate the averaging strategy.

ROC-AUC MUST only be displayed when it is mathematically applicable. If it cannot be calculated, display a clear explanation instead of fabricating a value.

## Regression Metrics

The system MUST calculate and display:

- MAE
- MSE
- RMSE
- R² Score

---

# 11. Visualization Requirements

## Dataset Visualizations

Provide:

- Feature distribution plots
- Correlation heatmap
- Missing-value visualization

Do not attempt to create meaningless correlation plots for purely categorical data.

## Classification Visualizations

Provide:

- Confusion Matrix Heatmap
- ROC Curve where applicable

## Regression Visualizations

Provide:

- Actual vs Predicted Plot
- Residual Plot

Charts should be generated by the Python ML service and returned in a frontend-consumable format.

---

# 12. Prediction Module

After a model has been successfully trained, the user MUST be able to enter new feature values.

The system MUST:

1. Validate input values.
2. Apply the exact preprocessing pipeline used during training.
3. Load the saved best model.
4. Generate prediction.
5. Return the predicted value/class.

For classification, display prediction confidence/probability only when the selected model supports an appropriate probability/confidence mechanism.

Do NOT call arbitrary raw model prediction without applying the saved preprocessing pipeline.

---

# 13. Model Persistence

The best trained model MUST be saved together with all required preprocessing information.

Prefer saving a complete Scikit-learn Pipeline when practical.

The saved model metadata should include:

- Model ID
- Dataset ID
- Target column
- Feature columns
- Task type
- Algorithm
- Preprocessing configuration
- Best hyperparameters
- Training timestamp
- Evaluation metrics
- Model version

The system MUST prevent incompatible models from being used with incompatible feature schemas.

---

# 14. Database Rules

Use PostgreSQL as the primary relational database.

Use pgvector only where vector storage/search is genuinely useful, such as:

- Dataset/document embeddings
- Experiment metadata retrieval
- Agent knowledge/retrieval workflows

Do NOT use pgvector unnecessarily for normal relational records.

Recommended entities:

```text
users
datasets
dataset_columns
experiments
models
model_metrics
predictions
agent_runs
audit_logs
```

Use foreign keys and appropriate indexes.

Never store passwords in plain text.

---

# 15. Authentication

Authentication must be implemented through the project's chosen auth module.

The system should support:

- User registration/login where applicable
- Session handling
- Protected API routes
- User-specific datasets
- User-specific trained models
- User-specific experiment history

A user MUST NOT be able to access another user's private datasets, models, predictions, or experiment records.

---

# 16. Backend Rules

The Node.js/Express backend MUST be organized into clear layers.

Recommended:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository / Database
```

Do not put all application logic into route files.

Recommended backend responsibilities:

- Authentication
- File upload handling
- Dataset metadata
- User/project management
- Experiment management
- ML-service communication
- Model metadata
- Prediction requests
- Error handling
- Observability
- Agent orchestration

The backend MUST validate request bodies and uploaded files.

---

# 17. Python ML Service Rules

The Python service owns ML-specific logic.

It should contain modules for:

- Dataset loading
- Dataset profiling
- Preprocessing
- Model registry
- Training
- Hyperparameter tuning
- Evaluation
- Visualization
- Prediction
- Model persistence

Do not duplicate ML logic between Node.js and Python.

The Python service MUST expose a clean API such as:

```text
POST /dataset/analyze
POST /train
POST /evaluate
POST /predict
GET  /health
```

Exact routes may be adjusted as implementation evolves, but responsibilities must remain separated.

---

# 18. Recommended Folder Structure

Use a monorepo structure:

```text
ml-web-app/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── lib/
│   │   ├── types/
│   │   └── utils/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   ├── validators/
│   │   ├── agents/
│   │   ├── db/
│   │   ├── utils/
│   │   └── app/
│   ├── tests/
│   ├── package.json
│   └── ...
│
├── ml-service/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── preprocessing/
│   │   ├── models/
│   │   ├── training/
│   │   ├── evaluation/
│   │   ├── visualization/
│   │   ├── prediction/
│   │   ├── schemas/
│   │   └── utils/
│   ├── tests/
│   ├── requirements.txt
│   └── ...
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema/
│
├── shared/
│   ├── types/
│   └── constants/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   └── project-report/
│
├── datasets/
│   └── sample/
│
├── models/
│   └── .gitkeep
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── README.md
└── RULE.md
```

The exact folder names may evolve, but the separation of frontend, backend, ML service, database, and shared resources MUST remain.

---

# 19. Frontend UI Rules

Use:

- React
- Tailwind CSS
- shadcn/ui

The UI should be clean, responsive, and beginner-friendly.

Required major screens/components:

```text
Dashboard
Dataset Upload
Dataset Explorer
Dataset Configuration
Model Selection
Training Configuration
Training Progress
Evaluation Dashboard
Prediction
Experiment History
Model Details
```

The UI MUST provide useful loading, success, empty, and error states.

Do not leave users staring at a blank screen during model training.

---

# 20. API Design

Use REST APIs between frontend and Node.js backend.

Use JSON for normal API communication.

For long-running training jobs, do not block the request indefinitely.

Preferred workflow:

```text
POST /experiments
        ↓
Return experiment/job ID
        ↓
Training starts
        ↓
Frontend polls or receives status updates
        ↓
Training completes
        ↓
Fetch results
```

Possible experiment states:

```text
PENDING
RUNNING
COMPLETED
FAILED
CANCELLED
```

---

# 21. LangGraph Agent Rules

LangGraph is mandatory for agentic functionality.

Use it for workflows such as:

```text
Dataset Analysis
      ↓
Dataset Understanding
      ↓
Configuration Validation
      ↓
Model Recommendation/Explanation
      ↓
Training Workflow
      ↓
Result Interpretation
```

The agent MUST NOT fabricate:

- Dataset statistics
- Model metrics
- Predictions
- Hyperparameters
- Training results

All numerical ML results must come from the actual ML pipeline.

LLM-generated explanations must be clearly separated from deterministic ML outputs.

---

# 22. LLM Rules

Groq with an open-source model is the default LLM provider.

The LLM may be used for:

- Explaining dataset characteristics
- Explaining metrics
- Explaining model behavior
- Providing natural-language summaries
- Guiding users through the ML workflow

The LLM MUST NOT replace Scikit-learn for model training.

Do not send sensitive dataset contents to the LLM unnecessarily.

Use environment variables for API keys.

Never hardcode API keys.

---

# 23. Observability

Langfuse is mandatory.

Track relevant agent/LLM operations such as:

- Trace ID
- User/session context where appropriate
- Agent workflow
- Model used
- Prompt/token information where available
- Latency
- Errors
- Tool calls

Do not log secrets, passwords, authentication tokens, or sensitive raw dataset contents.

Application errors should also be logged using structured logging.

---

# 24. Environment Variables

Secrets and environment-specific configuration MUST NOT be committed to Git.

Use:

```text
.env
.env.example
```

Example categories:

```text
DATABASE_URL
GROQ_API_KEY
LANGFUSE_SECRET_KEY
LANGFUSE_PUBLIC_KEY
LANGFUSE_HOST
AUTH_SECRET
ML_SERVICE_URL
```

`.env.example` must contain variable names and safe placeholder values only.

---

# 25. Security Rules

The agent MUST treat uploaded datasets and user input as untrusted.

Required protections:

- File type validation
- File size limits
- Input validation
- Authentication
- Authorization
- Secure file handling
- Safe subprocess behavior
- No arbitrary code execution from uploaded CSVs
- No hardcoded credentials
- No secrets in frontend code
- No SQL string concatenation for user input
- Parameterized database queries
- Proper CORS configuration

Never execute Python code contained in a dataset.

---

# 26. Error Handling

Every major layer MUST have proper error handling.

Errors should contain:

```text
error code
message
request/trace ID
optional safe details
```

Do not expose:

- Stack traces to normal users
- Database credentials
- API keys
- Internal filesystem paths
- Sensitive implementation details

The frontend should show human-readable errors.

---

# 27. Testing Requirements

Add tests for important functionality.

Minimum areas:

### Backend

- Authentication
- Dataset upload
- Dataset metadata
- API validation
- Authorization
- Experiment lifecycle

### ML Service

- Dataset preprocessing
- Missing-value handling
- Encoding
- Scaling
- Train/test split
- Each supported algorithm
- Hyperparameter tuning
- Classification metrics
- Regression metrics
- Prediction
- Model persistence

### Frontend

- Dataset upload flow
- Configuration flow
- Model selection
- Training state
- Evaluation display
- Prediction form

Tests MUST be deterministic where possible.

---

# 28. Git Rules

Use meaningful commits.

Preferred examples:

```text
feat: add dataset upload API
feat: implement classification pipeline
feat: add model evaluation dashboard
fix: prevent preprocessing data leakage
fix: validate uploaded CSV
refactor: separate ML service from API
docs: update setup instructions
```

Do not commit:

```text
.env
API keys
passwords
large generated datasets
trained model binaries unless explicitly required
node_modules
Python virtual environments
build directories
```

---

# 29. Documentation Rules

The project MUST maintain a useful `README.md`.

README should contain:

1. Project overview
2. Architecture
3. Features
4. Technology stack
5. Folder structure
6. Installation
7. Environment variables
8. Database setup
9. ML service setup
10. Running the project
11. API overview
12. Example workflow
13. Testing
14. Deployment

Code that is difficult to understand should have concise documentation.

Do not write unnecessary comments for obvious code.

---

# 30. Development Rules for the Agent

Before implementing a feature:

1. Inspect the existing project structure.
2. Understand the current architecture.
3. Reuse existing utilities/components.
4. Check whether the functionality already exists.
5. Identify dependencies.
6. Implement the smallest clean solution.
7. Run relevant tests/build checks.
8. Fix errors before moving on.
9. Update documentation when architecture or setup changes.

Do not rewrite the entire project for a small feature.

Do not introduce a new library when the existing stack can solve the problem.

---

# 31. Code Quality Rules

Code MUST be:

- Modular
- Readable
- Maintainable
- Reusable
- Properly validated
- Consistent with the existing architecture

Avoid:

- Giant files
- Giant functions
- Duplicate logic
- Hardcoded configuration
- Magic numbers
- Dead code
- Unused dependencies
- Unnecessary abstractions

Use clear naming.

Prefer composition over unnecessary inheritance.

---

# 32. ML Reproducibility Rules

Training should record:

- Random seed
- Dataset identifier/version
- Feature list
- Target
- Preprocessing configuration
- Train/test split configuration
- Algorithm
- Hyperparameters
- Tuning method
- Metrics
- Timestamp

Where supported, use deterministic random states.

A trained experiment should be reproducible from its stored configuration.

---

# 33. Dataset Versioning

Treat every uploaded dataset as a separate dataset version or immutable dataset record.

Do not silently overwrite datasets.

Store enough metadata to reproduce an experiment.

Example:

```text
Dataset
  ├── Dataset ID
  ├── Filename
  ├── Hash
  ├── Row count
  ├── Column count
  ├── Schema
  └── Upload timestamp
```

---

# 34. Model Registry

Maintain a logical model registry.

Each model should have:

```text
Model ID
Experiment ID
Algorithm
Task
Dataset ID
Features
Target
Hyperparameters
Metrics
Artifact location
Created timestamp
Status
```

Only successfully trained models should be available for prediction.

---

# 35. Performance Rules

Do not load huge datasets entirely into memory without considering size limits.

For normal academic/project datasets, Pandas is acceptable.

For long-running operations:

- Use background jobs where needed.
- Report progress.
- Avoid blocking the main API.
- Store experiment status.

The frontend must remain responsive during training.

---

# 36. Deployment Rules

Target deployment:

```text
Frontend → Vercel
Node.js Backend → Railway
Python ML Service → Railway or compatible service
PostgreSQL → Railway PostgreSQL
```

The deployment architecture MUST keep secrets server-side.

CORS and environment variables must be configured separately for development and production.

---

# 37. Project Scope Rules

The core project is the ML application described in this document.

Do not add unrelated features simply because they are technically interesting.

Prioritize:

1. Dataset upload
2. Dataset analysis
3. Configuration
4. Preprocessing
5. Model training
6. Hyperparameter tuning
7. Evaluation
8. Visualization
9. Model persistence
10. Prediction
11. Authentication
12. Experiment history
13. Agent-assisted explanations
14. Observability

Optional features must not break the core workflow.

---

# 38. Definition of Done

A feature is NOT complete until:

- It works end-to-end.
- Input validation exists.
- Error handling exists.
- Relevant tests pass.
- It follows the folder architecture.
- No secrets are hardcoded.
- API contracts are documented where appropriate.
- UI loading/error states exist where applicable.
- ML results are generated from actual computation.
- Data leakage is avoided.
- Existing functionality is not unnecessarily broken.

---

# 39. Final Agent Instruction

You are working on an end-to-end Machine Learning web application.

Always preserve the separation:

```text
React UI
   ↓
Node.js/Express API
   ↓
Python ML Service
   ↓
Scikit-learn / Pandas / NumPy
   ↓
Model + Metrics + Visualizations
```

Use PostgreSQL for application data and pgvector only for legitimate vector-search requirements.

Use LangGraph for agentic workflows.

Use Groq/open-source LLMs by default for natural-language AI functionality.

Use Langfuse for observability.

Never allow an LLM to invent ML results.

Never introduce data leakage.

Never expose secrets.

Never bypass authentication/authorization.

Never silently change user-selected dataset configuration.

Before making architectural changes, check whether the change is necessary and whether it remains consistent with this RULE.md.

When requirements conflict, prioritize:

1. Correctness
2. Security
3. Data integrity
4. ML validity
5. Maintainability
6. User experience
7. Performance

The agent should implement the project incrementally, verify each major stage, and keep the codebase in a runnable state throughout development.
