#!/usr/bin/env python3
"""
Jira Campaign Update Tool
Automatically processes Jira campaign exports and generates formatted Excel reports.
"""

import json
import sys
from pathlib import Path
from datetime import datetime
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Border, Side, Alignment
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.worksheet.datavalidation import DataValidation

# Set UTF-8 encoding for console output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def get_downloads_folder():
    """Get the user's Downloads folder path."""
    return Path.home() / "Downloads"


def find_latest_jira_export():
    """Find the most recent file in Downloads containing 'jira'."""
    downloads = get_downloads_folder()

    # Find all files containing 'jira' (case-insensitive)
    jira_files = [
        f for f in downloads.glob("*")
        if f.is_file() and "jira" in f.name.lower()
    ]

    if not jira_files:
        print("❌ No Jira export file found in Downloads folder")
        return None

    # Sort by modification time (most recent first)
    latest = sorted(jira_files, key=lambda f: f.stat().st_mtime, reverse=True)[0]
    return latest


def load_config(config_path):
    """Load campaign definitions from JSON config file."""
    if not config_path.exists():
        # Create template config if it doesn't exist
        template = {
            "campaigns": [
                {
                    "id": "PROJ-1",
                    "name": "Example Campaign",
                    "description": "Campaign description",
                    "owner": "Team Name",
                    "custom_fields": {}
                }
            ],
            "jira_base_url": "https://yourcompany.atlassian.net",
            "output_settings": {
                "output_folder": "./reports",
                "include_fields": ["key", "summary", "status", "assignee", "priority", "labels"]
            }
        }

        with open(config_path, "w") as f:
            json.dump(template, f, indent=2)

        print(f"✓ Created template config: {config_path}")
        return template

    try:
        with open(config_path, "r") as f:
            config = json.load(f)
        print(f"✓ Loaded campaign definitions from {config_path.name}")
        return config
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing config file: {e}")
        sys.exit(1)


def read_jira_export(file_path):
    """Read Jira export file (Excel or CSV)."""
    try:
        if file_path.suffix.lower() in ['.csv']:
            df = pd.read_csv(file_path)
        else:
            # Try to read as Excel, specify engine if needed
            try:
                df = pd.read_excel(file_path)
            except:
                # Fallback to openpyxl engine
                df = pd.read_excel(file_path, engine='openpyxl')

        print(f"✓ Read Jira export: {file_path.name}")
        print(f"  - {len(df)} total rows")
        return df
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        sys.exit(1)


def process_campaigns(df, config):
    """Filter and process campaign data from the export."""
    # Make column names case-insensitive for lookup
    df_cols = {col.lower(): col for col in df.columns}

    # Try to find the issue type column
    issue_type_col = None
    for potential_col in ["issue type", "issuetype", "type"]:
        if potential_col in df_cols:
            issue_type_col = df_cols[potential_col]
            break

    # Filter for campaigns
    if issue_type_col:
        campaigns_df = df[df[issue_type_col].str.lower() == "campaign"].copy()
    else:
        # If no issue type column, assume all rows are campaigns
        campaigns_df = df.copy()

    print(f"✓ Found {len(campaigns_df)} campaign tickets")

    return campaigns_df


def create_formatted_workbook(campaigns_df, config, output_path):
    """Create a formatted Excel workbook with multiple sheets."""
    wb = Workbook()
    wb.remove(wb.active)  # Remove default sheet

    # Define colors for status
    status_colors = {
        "done": "C6EFCE",
        "in progress": "FFF2CC",
        "todo": "FCE4D6",
        "blocked": "F8CBAD",
    }

    # Define styles
    header_fill = PatternFill(start_color="1e3a2f", end_color="1e3a2f", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin")
    )

    jira_url = config.get("jira_base_url", "https://jira.atlassian.net")

    # Create Summary sheet
    ws_summary = wb.create_sheet("Summary", 0)
    summary_data = [
        ["Campaign Update Report", ""],
        ["Generated", datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
        ["", ""],
        ["Total Campaigns", len(campaigns_df)],
    ]

    # Add status breakdown if status column exists
    if any(col.lower() == "status" for col in campaigns_df.columns):
        status_col = next(col for col in campaigns_df.columns if col.lower() == "status")
        status_counts = campaigns_df[status_col].value_counts()
        summary_data.append(["", ""])
        summary_data.append(["Status Breakdown", ""])
        for status, count in status_counts.items():
            summary_data.append([status, count])

    for row_idx, row in enumerate(summary_data, 1):
        for col_idx, value in enumerate(row, 1):
            cell = ws_summary.cell(row_idx, col_idx, value)
            if row_idx == 1:
                cell.font = Font(bold=True, size=14)

    ws_summary.column_dimensions["A"].width = 25
    ws_summary.column_dimensions["B"].width = 15

    # Create Campaign Details sheet
    ws_details = wb.create_sheet("Campaign Details", 1)

    # Prepare data for details sheet
    display_df = campaigns_df.copy()

    # Rename columns for display
    column_mapping = {
        col: col.replace("_", " ").title()
        for col in display_df.columns
    }
    display_df = display_df.rename(columns=column_mapping)

    # Write headers
    for col_idx, column_title in enumerate(display_df.columns, 1):
        cell = ws_details.cell(1, col_idx, column_title)
        cell.fill = header_fill
        cell.font = header_font
        cell.border = border
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Write data rows
    for row_idx, row in enumerate(dataframe_to_rows(display_df, index=False, header=False), 2):
        for col_idx, value in enumerate(row, 1):
            cell = ws_details.cell(row_idx, col_idx, value)
            cell.border = border
            cell.alignment = Alignment(vertical="top", wrap_text=True)

            # Apply status colors
            if col_idx < len(row) and "status" in display_df.columns[col_idx - 1].lower():
                status_key = str(value).lower() if value else ""
                for key, color in status_colors.items():
                    if key in status_key:
                        cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
                        break

    # Auto-fit columns
    for column in ws_details.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws_details.column_dimensions[column_letter].width = adjusted_width

    # Freeze header row
    ws_details.freeze_panes = "A2"

    # Create Timeline sheet if date columns exist
    date_columns = [col for col in display_df.columns if "date" in col.lower() or "created" in col.lower()]
    if date_columns:
        ws_timeline = wb.create_sheet("Timeline", 2)

        # Sort by first date column found
        timeline_df = display_df.copy()
        try:
            timeline_df = timeline_df.sort_values(date_columns[0])
        except:
            pass

        # Write headers
        for col_idx, column_title in enumerate(timeline_df.columns, 1):
            cell = ws_timeline.cell(1, col_idx, column_title)
            cell.fill = header_fill
            cell.font = header_font
            cell.border = border
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        # Write data rows
        for row_idx, row in enumerate(dataframe_to_rows(timeline_df, index=False, header=False), 2):
            for col_idx, value in enumerate(row, 1):
                cell = ws_timeline.cell(row_idx, col_idx, value)
                cell.border = border
                cell.alignment = Alignment(vertical="top", wrap_text=True)

        # Auto-fit columns
        for column in ws_timeline.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws_timeline.column_dimensions[column_letter].width = adjusted_width

        ws_timeline.freeze_panes = "A2"

    # Save workbook
    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(output_path)
    print(f"✓ Generated report: {output_path}")


def main():
    """Main execution flow."""
    script_dir = Path(__file__).parent
    config_path = script_dir / "campaign_definitions.json"

    print("🚀 Jira Campaign Update Tool\n")

    # Load configuration
    config = load_config(config_path)

    # Find latest Jira export
    jira_file = find_latest_jira_export()
    if not jira_file:
        print("\n💡 Tip: Export campaigns from Jira and save to your Downloads folder")
        sys.exit(1)

    print(f"✓ Found: {jira_file.name}\n")

    # Read and process data
    df = read_jira_export(jira_file)
    campaigns_df = process_campaigns(df, config)

    if len(campaigns_df) == 0:
        print("⚠️  No campaigns found in export")
        sys.exit(0)

    # Generate output
    output_folder = script_dir / config.get("output_settings", {}).get("output_folder", "reports")
    timestamp = datetime.now().strftime("%Y-%m-%d")
    output_file = output_folder / f"campaign_update_{timestamp}.xlsx"

    create_formatted_workbook(campaigns_df, config, output_file)

    print(f"\n✅ Done! Report saved to: {output_file}")


if __name__ == "__main__":
    main()
