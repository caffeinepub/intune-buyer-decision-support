# INTUNE Buyer Decision Support

## Current State
Dashboard (KPI cards + charts + insights), Style Analysis (charts + table with Decision/Risk/Recommendation), Re-buy & Size Planning (Module 2 + 3), Reports. Dashboard already has strategic structure but user wants it to feel more decisive.

## Requested Changes (Diff)

### Add
- Decision Logic Box on Style Analysis page explaining 3 rules
- Markdown Module page (/markdown) with at-risk styles and recommended discount %
- Final Buyer Output panel on Re-buy & Size Planning page
- Markdown page in sidebar nav

### Modify
- Dashboard: add subtitle, make insights more action-oriented
- Style Analysis: add Decision Logic Box above table
- RebuySize: add Final Buyer Output card at bottom

### Remove
- Nothing

## Implementation Plan
1. Add Decision Logic Box in StyleAnalysis.tsx
2. Create MarkdownModule.tsx page with KPI cards + table
3. Add /markdown route in App.tsx
4. Add Markdown nav item in Sidebar.tsx
5. Add Final Buyer Output card in RebuySize.tsx
6. Enhance Dashboard header/insights
