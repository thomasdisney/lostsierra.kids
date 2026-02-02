# Jira Campaign Update Tool

A standalone Python tool that automatically processes Jira campaign exports and generates formatted, stakeholder-ready Excel reports.

## Features

- **Auto-detection**: Finds the most recent Jira export in your Downloads folder
- **Smart filtering**: Automatically identifies and processes campaign tickets
- **Formatted output**: Professional Excel reports with colors, borders, and headers
- **Multiple views**: Summary, detailed campaign list, and timeline sorted by dates
- **Configurable**: Edit campaign definitions in JSON without touching code

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. First Run

```bash
python campaign_updates.py
```

On first run, the tool will:
- Create `campaign_definitions.json` template
- Look for a Jira export in your Downloads folder
- Generate a formatted report in `reports/`

### 3. Regular Usage

Simply export your campaigns from Jira and save to Downloads (filename must contain "jira"). Then run:

```bash
python campaign_updates.py
```

The tool will automatically:
- ✓ Find your latest Jira export
- ✓ Load campaign definitions
- ✓ Process the data
- ✓ Generate a formatted Excel report with timestamp

## Configuration

### campaign_definitions.json

Edit this file to manage your campaigns without changing code:

```json
{
  "campaigns": [
    {
      "id": "PROJ-123",
      "name": "Q1 Marketing Campaign",
      "description": "Spring promotional campaign",
      "owner": "Marketing Team",
      "custom_fields": {}
    }
  ],
  "jira_base_url": "https://yourcompany.atlassian.net",
  "output_settings": {
    "output_folder": "./reports",
    "include_fields": ["key", "summary", "status", "assignee", "priority"]
  }
}
```

**Fields:**
- `campaigns`: Array of campaign definitions with ID, name, description, and owner
- `jira_base_url`: Your Jira instance URL (for potential future hyperlink integration)
- `output_settings`: Where to save reports and which fields to include

## Output Format

The generated Excel file contains three sheets:

### 1. Summary Sheet
- Report generation date/time
- Total campaign count
- Status breakdown (To Do, In Progress, Done, Blocked)

### 2. Campaign Details Sheet
- All campaign information in a clean table
- Frozen header row for easy scrolling
- Color-coded status (green=done, yellow=in progress, orange=todo, red=blocked)
- Auto-sized columns with text wrapping
- Professional borders and formatting

### 3. Timeline Sheet
- Campaigns sorted by date
- Useful for tracking campaign schedule
- Same formatting as Campaign Details

## File Structure

```
jira-campaign-tool/
├── campaign_updates.py          # Main executable script
├── campaign_definitions.json    # Campaign configuration (created on first run)
├── requirements.txt             # Python dependencies
├── README.md                    # This file
├── reports/                     # Generated Excel files
└── .gitignore
```

## Jira Export Format

The tool expects an Excel export from Jira with:
- An "Issue Type" column (or "Type", "issuetype") with values like "Campaign"
- Standard Jira columns: Key, Summary, Status, Assignee, etc.
- Any custom fields you want to include

**How to export from Jira:**
1. Go to your Jira project board
2. Filter for issues where Issue Type = Campaign
3. Click "Tools" → "Export" → "Export to Excel"
4. Save the file to your Downloads folder
5. Run the tool

## Examples

### Basic Setup
```bash
# Install dependencies
pip install -r requirements.txt

# First run (creates template config)
python campaign_updates.py

# Output:
# ✓ Created template config: campaign_definitions.json
# ❌ No Jira export file found in Downloads folder
```

### With Jira Export
```bash
# After exporting campaigns from Jira and saving to Downloads
python campaign_updates.py

# Output:
# ✓ Loaded campaign definitions from campaign_definitions.json
# ✓ Found: jira-export-2026-02-02.xlsx
# ✓ Read Jira export: jira-export-2026-02-02.xlsx
#   - 47 total rows
# ✓ Found 23 campaign tickets
# ✓ Generated report: reports/campaign_update_2026-02-02.xlsx
# ✅ Done! Report saved to: C:\Users\...\jira-campaign-tool\reports\campaign_update_2026-02-02.xlsx
```

### Edit Configuration
```bash
# Open campaign_definitions.json in your editor
# Add new campaigns, modify descriptions, update owner
# Save and run the tool again - changes take effect immediately
python campaign_updates.py
```

## Troubleshooting

### "No Jira export file found in Downloads folder"
- Export your campaigns from Jira
- Make sure the filename contains "jira" (any case)
- Save it to your Downloads folder
- Run the tool again

### "Error reading Excel file"
- Ensure you're exporting from Jira in Excel format
- Check that the file isn't corrupted
- Try exporting again

### "Error parsing config file"
- Check `campaign_definitions.json` for syntax errors
- Make sure JSON is properly formatted (use a JSON validator)
- Delete the file and run the tool to regenerate the template

## Requirements

- **Python 3.8 or higher**
- **pandas** - Data processing and Excel reading
- **openpyxl** - Excel formatting and styling

## Future Enhancements

Potential features for future versions:
- Command-line arguments for custom input/output paths
- Email integration to send reports automatically
- Historical tracking to compare campaign progress over time
- Web UI for viewing and sharing reports
- Automatic campaign matching based on Jira labels or custom fields
- Custom formatting templates

## License

This tool is provided as-is for internal use.
