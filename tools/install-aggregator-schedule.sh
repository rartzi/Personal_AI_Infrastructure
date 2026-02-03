#!/usr/bin/env bash

#
# install-aggregator-schedule.sh
#
# Installs the daily metric aggregation schedule via launchd (macOS)
#
# Usage:
#   bash tools/install-aggregator-schedule.sh
#

set -e

# Determine paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/.claude"
HOME_DIR="$HOME"

PLIST_TEMPLATE="$SCRIPT_DIR/com.pai.metric-aggregator.plist"
PLIST_INSTALL="$HOME_DIR/Library/LaunchAgents/com.pai.metric-aggregator.plist"

echo "📅 Installing PAI metric aggregator schedule..."
echo ""
echo "  PAI Directory: $PAI_DIR"
echo "  Home Directory: $HOME_DIR"
echo "  Install to: $PLIST_INSTALL"
echo ""

# Create LaunchAgents directory if needed
mkdir -p "$HOME_DIR/Library/LaunchAgents"

# Replace placeholders and install
sed -e "s|__PAI_DIR__|$PAI_DIR/..|g" \
    -e "s|__HOME__|$HOME_DIR|g" \
    "$PLIST_TEMPLATE" > "$PLIST_INSTALL"

echo "✓ plist installed"

# Unload if already loaded
if launchctl list | grep -q com.pai.metric-aggregator; then
    echo "  Unloading existing job..."
    launchctl unload "$PLIST_INSTALL" 2>/dev/null || true
fi

# Load the job
echo "  Loading job..."
launchctl load "$PLIST_INSTALL"

echo ""
echo "✅ Metric aggregator scheduled!"
echo ""
echo "Schedule: Daily at 23:30"
echo "Logs: ~/.claude/metrics/aggregator.log"
echo "Errors: ~/.claude/metrics/aggregator.error.log"
echo ""
echo "To uninstall:"
echo "  launchctl unload ~/Library/LaunchAgents/com.pai.metric-aggregator.plist"
echo "  rm ~/Library/LaunchAgents/com.pai.metric-aggregator.plist"
echo ""
echo "To test now:"
echo "  launchctl start com.pai.metric-aggregator"
echo ""
