"""
===============================================================================
HEMOFLOW - EXPLORATORY DATA ANALYSIS (EDA) FOR BLOOD BIOMARKERS
===============================================================================
A complete step-by-step guide for Data Science beginners demonstrating how
to inspect, clean, analyze, visualize, and extract insights from tabular 
health/medical datasets.
===============================================================================
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Set visual style for clean, beautiful plots
sns.set_theme(style="whitegrid")
plt.rcParams["font.sans-serif"] = "Arial"

# =============================================================================
# STAGE 0: GENERATE SAMPLE DATASET (Simulating 500 Patient Blood Panels)
# =============================================================================
np.random.seed(42)  # For reproducible results
n_patients = 500

data = {
    'patient_id': [f"P{i+1000}" for i in range(n_patients)],
    'age': np.random.randint(18, 80, size=n_patients),
    'sex': np.random.choice(['Male', 'Female'], size=n_patients, p=[0.48, 0.52]),
    'fasting': np.random.choice([True, False], size=n_patients, p=[0.85, 0.15]),
    'hemoglobin': np.random.normal(loc=14.0, scale=1.8, size=n_patients).round(1),
    'glucose_fasting': np.random.normal(loc=98.0, scale=25.0, size=n_patients).round(1),
    'hba1c': np.random.normal(loc=5.6, scale=0.9, size=n_patients).round(1),
    'cholesterol': np.random.normal(loc=195.0, scale=35.0, size=n_patients).round(1),
    'hdl': np.random.normal(loc=52.0, scale=12.0, size=n_patients).round(1),
    'ldl': np.random.normal(loc=115.0, scale=28.0, size=n_patients).round(1),
    'triglycerides': np.random.normal(loc=145.0, scale=45.0, size=n_patients).round(1),
    'vitamin_d': np.random.normal(loc=28.0, scale=10.0, size=n_patients).round(1),
}

df = pd.DataFrame(data)

# Introduce a few missing values (NaNs) to simulate real-world messy data
df.loc[np.random.choice(df.index, 15), 'vitamin_d'] = np.nan
df.loc[np.random.choice(df.index, 8), 'hba1c'] = np.nan

print("[+] Dataset generated successfully with shape:", df.shape)

# =============================================================================
# STAGE 1: INITIAL DATA INSPECTION ("First Look")
# =============================================================================
print("\n--- STAGE 1: FIRST LOOK AT DATA ---")
print("First 5 rows:")
print(df.head())

print("\nData Types & Non-Null Counts:")
print(df.info())

print("\nSummary Statistics for Numeric Features:")
print(df.describe().T[['mean', 'std', 'min', '50%', 'max']])

# =============================================================================
# STAGE 2: DATA CLEANING & MISSING VALUE AUDIT
# =============================================================================
print("\n--- STAGE 2: MISSING VALUES & CLEANING ---")
missing_counts = df.isnull().sum()
print("Missing values per column:\n", missing_counts[missing_counts > 0])

# Strategy: Fill missing Vitamin D and HbA1c with MEDIAN (robust to outliers)
df['vitamin_d'] = df['vitamin_d'].fillna(df['vitamin_d'].median())
df['hba1c'] = df['hba1c'].fillna(df['hba1c'].median())

print("Check after median imputation - Missing values count:", df.isnull().sum().sum())

# Check for duplicates
print("Duplicate rows count:", df.duplicated().sum())

# =============================================================================
# STAGE 3: UNIVARIATE ANALYSIS (Analyzing 1 Variable at a Time)
# =============================================================================
print("\n--- STAGE 3: UNIVARIATE ANALYSIS ---")

fig, axes = plt.subplots(1, 3, figsize=(16, 4.5))

# 1. Distribution of Hemoglobin
sns.histplot(df['hemoglobin'], kde=True, ax=axes[0], color='#2B6CB0', bins=20)
axes[0].set_title('Hemoglobin Distribution (g/dL)', fontweight='bold')
axes[0].axvline(12.0, color='red', linestyle='--', label='Ref Low (12.0)')
axes[0].axvline(16.0, color='red', linestyle='--', label='Ref High (16.0)')
axes[0].legend()

# 2. Distribution of Fasting Glucose
sns.histplot(df['glucose_fasting'], kde=True, ax=axes[1], color='#DD6B20', bins=20)
axes[1].set_title('Fasting Glucose Distribution (mg/dL)', fontweight='bold')
axes[1].axvline(100, color='orange', linestyle='--', label='Prediabetes Cutoff (100)')
axes[1].axvline(126, color='red', linestyle='--', label='Diabetes Cutoff (126)')
axes[1].legend()

# 3. Categorical Count plot: Sex Distribution
sns.countplot(data=df, x='sex', ax=axes[2], palette=['#3182CE', '#D53F8C'])
axes[2].set_title('Patient Breakdown by Sex', fontweight='bold')

plt.tight_layout()
plt.savefig('univariate_analysis.png', dpi=300)
print("Saved 'univariate_analysis.png'")

# =============================================================================
# STAGE 4: BIVARIATE & MULTIVARIATE ANALYSIS (Exploring Relationships)
# =============================================================================
print("\n--- STAGE 4: BIVARIATE & MULTIVARIATE ANALYSIS ---")

# 1. Scatter Plot: Fasting Glucose vs HbA1c (Colored by Sex)
plt.figure(figsize=(8, 5))
sns.scatterplot(data=df, x='glucose_fasting', y='hba1c', hue='sex', alpha=0.7, palette=['#3182CE', '#D53F8C'])
plt.title('Fasting Glucose vs HbA1c Correlation', fontweight='bold')
plt.xlabel('Fasting Glucose (mg/dL)')
plt.ylabel('HbA1c (%)')
plt.tight_layout()
plt.savefig('glucose_vs_hba1c.png', dpi=300)
print("Saved 'glucose_vs_hba1c.png'")

# 2. Correlation Matrix Heatmap
numeric_cols = ['age', 'hemoglobin', 'glucose_fasting', 'hba1c', 'cholesterol', 'hdl', 'ldl', 'triglycerides', 'vitamin_d']
corr_matrix = df[numeric_cols].corr()

plt.figure(figsize=(9, 7))
sns.heatmap(corr_matrix, annot=True, fmt=".2f", cmap='coolwarm', vmin=-1, vmax=1, linewidths=0.5)
plt.title('Biomarker Pearson Correlation Heatmap', fontweight='bold')
plt.tight_layout()
plt.savefig('correlation_heatmap.png', dpi=300)
print("Saved 'correlation_heatmap.png'")

# =============================================================================
# STAGE 5: OUTLIER DETECTION (IQR Method)
# =============================================================================
print("\n--- STAGE 5: OUTLIER DETECTION ---")

def detect_outliers_iqr(series):
    Q1 = series.quantile(0.25)
    Q3 = series.quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    outliers = series[(series < lower_bound) | (series > upper_bound)]
    return outliers, lower_bound, upper_bound

outliers_gl, low_b, high_b = detect_outliers_iqr(df['glucose_fasting'])
print(f"Glucose IQR Bounds: [{low_b:.1f}, {high_b:.1f}]")
print(f"Number of Glucose Outliers Detected: {len(outliers_gl)}")

# Visualizing Outliers with a Boxplot
plt.figure(figsize=(7, 4))
sns.boxplot(x=df['glucose_fasting'], color='#ECC94B')
plt.title('Fasting Glucose Boxplot (Outlier Inspection)', fontweight='bold')
plt.tight_layout()
plt.savefig('glucose_boxplot.png', dpi=300)
print("Saved 'glucose_boxplot.png'")

# =============================================================================
# STAGE 6: FEATURE ENGINEERING & CLINICAL INSIGHTS
# =============================================================================
print("\n--- STAGE 6: FEATURE ENGINEERING & DERIVED METRICS ---")

# 1. Total Cholesterol / HDL Ratio (Cardiovascular Risk Index)
df['chol_hdl_ratio'] = (df['cholesterol'] / df['hdl']).round(2)

# 2. Categorize Metabolic Risk Status based on Fasting Glucose
def categorize_glucose(g):
    if g < 70:
        return 'Hypoglycemic'
    elif g <= 99:
        return 'Normal'
    elif g <= 125:
        return 'Prediabetes'
    else:
        return 'Diabetes Risk'

df['metabolic_status'] = df['glucose_fasting'].apply(categorize_glucose)

print("\nMetabolic Status Breakdown:")
print(df['metabolic_status'].value_counts())

print("\nAverage Cholesterol/HDL Ratio by Sex:")
print(df.groupby('sex')['chol_hdl_ratio'].mean())

print("\n================ EDA COMPLETE! ALL PLOTS GENERATED ==================")
