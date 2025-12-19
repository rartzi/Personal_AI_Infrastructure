# ⚠️ WRONG LOCATION - DO NOT USE THIS DIRECTORY

**This directory (`/history/`) is the WRONG location for PAI history files.**

## Correct Location

All history files MUST be saved to:
```
${PAI_DIR}/History/
= /Users/kjzc236/workrelated/odsp/innovation_group/external/Personal_AI_Infrastructure/.claude/History/
```

**Note:** Capital 'H' in `History/` - this is the official UOCS (Universal Output Capture System)

## Directory Structure

```
.claude/History/
├── Sessions/YYYY-MM/
├── Learnings/YYYY-MM/
├── Research/YYYY-MM/    ← Research reports go here
├── Decisions/YYYY-MM/
├── Execution/
│   ├── Features/YYYY-MM/
│   ├── Bugs/YYYY-MM/
│   └── Refactors/YYYY-MM/
└── Raw-Outputs/YYYY-MM/
```

## Why This Matters

1. **Automatic Hook Integration:** The official History directory integrates with PAI's hook system
2. **Consistent Organization:** All agents and tools use the official location
3. **Git Integration:** Proper `.gitignore` rules apply to the correct location
4. **Documentation System:** UOCS documentation references the official location

## If You Created Files Here

Move them immediately:
```bash
# Move research files
mv history/research/YYYY-MM/* ${PAI_DIR}/History/Research/YYYY-MM/

# Remove incorrect directory
rm -rf history/
```

## Prevention

This warning file exists to prevent future mistakes. Always use:
```bash
${PAI_DIR}/History/Research/YYYY-MM/filename.md
```

**Never use:**
```bash
./history/  # ❌ WRONG - root level
```
