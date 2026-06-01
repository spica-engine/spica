---
name: tech-debt
description: Generates technical debt remediation plans for code, tests, and documentation. Use when you need to assess and prioritize technical debt, plan refactoring work, or create actionable remediation steps for code quality issues.
---

# Technical Debt Remediation Plan

Generate comprehensive technical debt remediation plans. Analysis only — no code modifications. Keep recommendations concise and actionable.

## Analysis Framework

Create a Markdown document with these required sections.

### Core Metrics (1-5 scale)

- **Ease of Remediation**: Implementation difficulty (1=trivial, 5=complex)
- **Impact**: Effect on codebase quality (1=minimal, 5=critical)
- **Risk**: Consequence of inaction (1=negligible, 5=severe)
  - 🟢 Low Risk
  - 🟡 Medium Risk
  - 🔴 High Risk

### Required Sections

- **Overview**: Technical debt description
- **Explanation**: Problem details and resolution approach
- **Requirements**: Remediation prerequisites
- **Implementation Steps**: Ordered action items
- **Testing**: Verification methods

## Common Technical Debt Types

- Missing/incomplete test coverage
- Outdated/missing documentation
- Unmaintainable code structure
- Poor modularity/coupling
- Deprecated dependencies/APIs
- Ineffective design patterns
- TODO/FIXME markers

## Output Format

1. **Summary Table**: Overview, Ease, Impact, Risk, Explanation
2. **Detailed Plan**: All required sections per debt item

## GitHub Integration

- Search existing issues before creating new ones to avoid duplicates
- Reference existing issues when relevant
- Use the project's issue templates for remediation tasks
