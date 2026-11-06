# BrandShield AI — Baseline Extraction Evaluation Report
**Evaluation Date:** 2026-11-06T13:07:02.797Z
**Model:** gpt-4o-mini | **Prompt Version:** 1.0.0
**Evaluated Population:** 56 human-reviewed records (31 approved, 25 modified)
**Excluded:** 64 AI-only audited records

## 1. Executive Performance Metrics
| Metric | Strict (Exact Span) | Relaxed (IoU ≥ 0.5) |
| :--- | :---: | :---: |
| **Precision** | 100.0% | 100.0% |
| **Recall** | 100.0% | 100.0% |
| **F1 Score** | 100.0% | 100.0% |

### Subsystem Alignment Metrics
- **Exact Span Accuracy**: 100.0%
- **Category Classification Accuracy**: 100.0%
- **Entity Extraction Accuracy**: 100.0%
- **Zero-Claim False Positive Rate**: 0.0% (7 hard negative records)
- **Zod Schema Validation Success Rate**: 100.0%

## 2. Stratified Performance Breakdown
| Cohort | Records | GT Claims | Precision (Relaxed) | Recall (Relaxed) | F1 (Relaxed) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Human-Approved** | 31 | 53 | 100.0% | 100.0% | 100.0% |
| **Human-Modified** | 25 | 70 | 100.0% | 100.0% | 100.0% |
| **Ambiguous Cases** | 9 | 15 | 100.0% | 100.0% | 100.0% |

## 3. Per-Category Claim Metrics
| Category | GT Claims | Pred Claims | Precision | Recall | F1 | Span Acc | Category Acc | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **price** | 12 | 12 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ✓ Adequate |
| **discount** | 8 | 8 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ⚠️ N < 10 (Insufficient) |
| **product_attribute** | 24 | 24 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ✓ Adequate |
| **efficacy** | 27 | 27 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ✓ Adequate |
| **guarantee** | 11 | 11 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ✓ Adequate |
| **comparative** | 8 | 8 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ⚠️ N < 10 (Insufficient) |
| **clinical** | 7 | 7 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ⚠️ N < 10 (Insufficient) |
| **availability** | 9 | 9 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ⚠️ N < 10 (Insufficient) |
| **promotional** | 10 | 10 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ✓ Adequate |
| **other** | 7 | 7 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | ⚠️ N < 10 (Insufficient) |

## 4. Token Usage and Cost
- **Prompt Tokens**: 53,200
- **Completion Tokens**: 7,730
- **Total Tokens**: 60,930
- **Estimated API Cost**: $0.0126 USD
