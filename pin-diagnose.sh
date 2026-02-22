#!/bin/bash
# ============================================================================
# PIN Local Diagnostics CLI
# Run from your project root: bash pin-diagnose.sh
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

BASE="http://localhost:3000"
PASS=0
FAIL=0
WARN=0

header() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BOLD}  $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
pass() { echo -e "  ${GREEN}✔${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✘${NC} $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN=$((WARN+1)); }
info() { echo -e "  ${DIM}→ $1${NC}"; }

# ============================================================================
header "1. LOCAL DEV SERVER CHECK"
# ============================================================================

echo -e "  Checking if Next.js dev server is running on port 3000..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE" --max-time 5 | grep -q "200\|304\|301\|302"; then
  pass "Dev server is running on $BASE"
else
  fail "Dev server not responding on $BASE"
  echo -e "  ${RED}Start your dev server first: npm run dev${NC}"
  echo -e "  ${RED}Then re-run this script.${NC}"
  exit 1
fi

# ============================================================================
header "2. API ROUTE HEALTH — /api/water-data"
# ============================================================================

echo -e "  Testing the failing endpoints from your console log...\n"

# Test 1: mmw-latest (Model My Watershed) — the coords from your log
echo -e "  ${BOLD}[mmw-latest] lat=39.263, lng=-76.623, radius=25${NC}"
MMW_RESP=$(curl -s -o /tmp/pin-mmw.json -w "%{http_code}|%{time_total}" \
  "$BASE/api/water-data?action=mmw-latest&lat=39.263&lng=-76.623&radius=25" \
  --max-time 30 2>&1)
MMW_CODE=$(echo "$MMW_RESP" | cut -d'|' -f1)
MMW_TIME=$(echo "$MMW_RESP" | cut -d'|' -f2)

if [ "$MMW_CODE" = "200" ]; then
  pass "mmw-latest returned 200 in ${MMW_TIME}s"
  info "Response preview:"
  head -c 300 /tmp/pin-mmw.json | sed 's/^/    /'
  echo ""
elif [ "$MMW_CODE" = "502" ]; then
  fail "mmw-latest returned 502 (Bad Gateway) — ${MMW_TIME}s"
  info "Response body:"
  cat /tmp/pin-mmw.json | head -c 500 | sed 's/^/    /'
  echo ""
  info "This is the main error from your log. Check your API route handler."
elif [ "$MMW_CODE" = "504" ]; then
  fail "mmw-latest returned 504 (Gateway Timeout) — ${MMW_TIME}s"
  info "Upstream API is too slow. Add timeout handling."
elif [ "$MMW_CODE" = "000" ]; then
  fail "mmw-latest — connection refused or timed out"
else
  warn "mmw-latest returned $MMW_CODE in ${MMW_TIME}s"
  cat /tmp/pin-mmw.json | head -c 300 | sed 's/^/    /'
  echo ""
fi

# Test 2: second coord set from log
echo -e "\n  ${BOLD}[mmw-latest] lat=39.262, lng=-76.476, radius=25${NC}"
MMW2_RESP=$(curl -s -o /tmp/pin-mmw2.json -w "%{http_code}|%{time_total}" \
  "$BASE/api/water-data?action=mmw-latest&lat=39.262&lng=-76.476&radius=25" \
  --max-time 30 2>&1)
MMW2_CODE=$(echo "$MMW2_RESP" | cut -d'|' -f1)
MMW2_TIME=$(echo "$MMW2_RESP" | cut -d'|' -f2)

if [ "$MMW2_CODE" = "200" ]; then
  pass "mmw-latest (coord 2) returned 200 in ${MMW2_TIME}s"
elif [ "$MMW2_CODE" = "502" ]; then
  fail "mmw-latest (coord 2) returned 502 — ${MMW2_TIME}s"
else
  warn "mmw-latest (coord 2) returned $MMW2_CODE in ${MMW2_TIME}s"
fi

# Test 3: NOAA CO-OPS (Fort McHenry station 8574680)
echo -e "\n  ${BOLD}[coops-product] stationId=8574680, product=water_temperature${NC}"
COOPS_RESP=$(curl -s -o /tmp/pin-coops.json -w "%{http_code}|%{time_total}" \
  "$BASE/api/water-data?action=coops-product&stationId=8574680&product=water_temperature" \
  --max-time 30 2>&1)
COOPS_CODE=$(echo "$COOPS_RESP" | cut -d'|' -f1)
COOPS_TIME=$(echo "$COOPS_RESP" | cut -d'|' -f2)

if [ "$COOPS_CODE" = "200" ]; then
  pass "coops-product returned 200 in ${COOPS_TIME}s"
  info "Response preview:"
  head -c 300 /tmp/pin-coops.json | sed 's/^/    /'
  echo ""
elif [ "$COOPS_CODE" = "502" ]; then
  fail "coops-product returned 502 — ${COOPS_TIME}s"
  info "Response body:"
  cat /tmp/pin-coops.json | head -c 500 | sed 's/^/    /'
  echo ""
else
  warn "coops-product returned $COOPS_CODE in ${COOPS_TIME}s"
fi

# ============================================================================
header "3. UPSTREAM API DIRECT CHECK (bypass your API route)"
# ============================================================================

echo -e "  Hitting upstream APIs directly to isolate if the problem is yours or theirs...\n"

# NOAA CO-OPS direct
echo -e "  ${BOLD}[NOAA CO-OPS] Station 8574680 water_temperature${NC}"
NOAA_RESP=$(curl -s -o /tmp/pin-noaa-direct.json -w "%{http_code}|%{time_total}" \
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=8574680&product=water_temperature&datum=STND&units=english&time_zone=gmt&application=pearl_pin&format=json" \
  --max-time 15 2>&1)
NOAA_CODE=$(echo "$NOAA_RESP" | cut -d'|' -f1)
NOAA_TIME=$(echo "$NOAA_RESP" | cut -d'|' -f2)

if [ "$NOAA_CODE" = "200" ]; then
  pass "NOAA CO-OPS direct: 200 in ${NOAA_TIME}s"
  info "$(cat /tmp/pin-noaa-direct.json | head -c 200)"
else
  fail "NOAA CO-OPS direct: $NOAA_CODE — upstream is down"
  info "If this fails, the 502 isn't your fault. NOAA is down."
fi

# EPA ATTAINS direct
echo -e "\n  ${BOLD}[EPA ATTAINS] Maryland summary${NC}"
ATTAINS_RESP=$(curl -s -o /tmp/pin-attains-direct.json -w "%{http_code}|%{time_total}" \
  "https://attains.epa.gov/attains-public/api/assessments?statecode=MD&assessmentUnitIdentifier=MD-020402040726&limit=1" \
  --max-time 20 2>&1)
ATTAINS_CODE=$(echo "$ATTAINS_RESP" | cut -d'|' -f1)
ATTAINS_TIME=$(echo "$ATTAINS_RESP" | cut -d'|' -f2)

if [ "$ATTAINS_CODE" = "200" ]; then
  pass "EPA ATTAINS direct: 200 in ${ATTAINS_TIME}s"
else
  warn "EPA ATTAINS direct: $ATTAINS_CODE in ${ATTAINS_TIME}s"
fi

# USGS Water Services direct
echo -e "\n  ${BOLD}[USGS] Real-time streamflow — Patapsco River near Catonsville${NC}"
USGS_RESP=$(curl -s -o /tmp/pin-usgs-direct.json -w "%{http_code}|%{time_total}" \
  "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01589000&parameterCd=00060,00065&period=PT1H" \
  --max-time 15 2>&1)
USGS_CODE=$(echo "$USGS_RESP" | cut -d'|' -f1)
USGS_TIME=$(echo "$USGS_RESP" | cut -d'|' -f2)

if [ "$USGS_CODE" = "200" ]; then
  pass "USGS Water Services direct: 200 in ${USGS_TIME}s"
else
  warn "USGS Water Services direct: $USGS_CODE in ${USGS_TIME}s"
fi

# Model My Watershed direct (WikiWatershed)
echo -e "\n  ${BOLD}[WikiWatershed / MMW] Direct API check${NC}"
MMW_DIRECT=$(curl -s -o /tmp/pin-mmw-direct.json -w "%{http_code}|%{time_total}" \
  "https://modelmywatershed.org/api/" \
  --max-time 15 2>&1)
MMW_D_CODE=$(echo "$MMW_DIRECT" | cut -d'|' -f1)
MMW_D_TIME=$(echo "$MMW_DIRECT" | cut -d'|' -f2)

if echo "$MMW_D_CODE" | grep -q "200\|301\|302"; then
  pass "WikiWatershed/MMW API reachable: $MMW_D_CODE in ${MMW_D_TIME}s"
else
  fail "WikiWatershed/MMW API unreachable: $MMW_D_CODE"
  info "This would explain all 5 mmw-latest 502s in your log"
fi

# ============================================================================
header "4. DUPLICATE KEY INVESTIGATION"
# ============================================================================

echo -e "  Searching for duplicate waterbody keys in your codebase...\n"

# Find where map keys are generated
echo -e "  ${BOLD}Searching LeafletMapShell.tsx for key generation...${NC}"
if [ -f "components/LeafletMapShell.tsx" ]; then
  KEYLINES=$(grep -n "key=" components/LeafletMapShell.tsx | head -10)
  if [ -n "$KEYLINES" ]; then
    info "Key assignments found:"
    echo "$KEYLINES" | sed 's/^/    /'
  fi
  echo ""
  
  # Check for the specific duplicates
  echo -e "  ${BOLD}Searching for the colliding names in data files...${NC}"
  DUPES=$(grep -rn "muddy_creek\|laurel_run\|buffalo_run" lib/ components/ --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | head -20)
  if [ -n "$DUPES" ]; then
    info "References to duplicate waterbody names:"
    echo "$DUPES" | sed 's/^/    /'
  fi
elif [ -f "src/components/LeafletMapShell.tsx" ]; then
  info "Found at src/components/LeafletMapShell.tsx"
  grep -n "key=" src/components/LeafletMapShell.tsx | head -10 | sed 's/^/    /'
else
  warn "LeafletMapShell.tsx not found in components/ or src/components/"
  info "Searching project..."
  find . -name "LeafletMapShell.tsx" -not -path "*/node_modules/*" 2>/dev/null | sed 's/^/    /'
fi

echo ""
echo -e "  ${BOLD}Checking MS4CommandCenter.tsx for waterbody data mapping...${NC}"
if [ -f "components/MS4CommandCenter.tsx" ]; then
  # Find where waterbody arrays are mapped to components with keys
  grep -n "\.map\s*(" components/MS4CommandCenter.tsx | head -10 | sed 's/^/    /'
  echo ""
  # Count lines
  LINES=$(wc -l < components/MS4CommandCenter.tsx)
  info "MS4CommandCenter.tsx: $LINES lines"
fi

# ============================================================================
header "5. PEARL-HEADER IMAGE CHECK"
# ============================================================================

echo -e "  ${BOLD}Checking Pearl-Header.png...${NC}"
HEADER_IMG=$(find . -name "Pearl-Header.png" -not -path "*/node_modules/*" 2>/dev/null)
if [ -n "$HEADER_IMG" ]; then
  pass "Found: $HEADER_IMG"
  if command -v identify &> /dev/null; then
    DIMS=$(identify -format "%wx%h" "$HEADER_IMG" 2>/dev/null)
    info "Dimensions: $DIMS"
  elif command -v file &> /dev/null; then
    info "$(file "$HEADER_IMG")"
  fi
else
  warn "Pearl-Header.png not found in project"
fi

echo ""
echo -e "  ${BOLD}Searching for <Image> usage of Pearl-Header...${NC}"
IMG_USAGE=$(grep -rn "Pearl-Header" --include="*.tsx" --include="*.jsx" --include="*.ts" . 2>/dev/null | grep -v node_modules | head -10)
if [ -n "$IMG_USAGE" ]; then
  echo "$IMG_USAGE" | sed 's/^/    /'
  echo ""
  # Check if width/height are both set
  if echo "$IMG_USAGE" | grep -q "width.*height\|height.*width"; then
    pass "Both width and height appear to be set"
  else
    warn "May be missing width or height — add style={{ width: 'auto' }} to fix"
  fi
fi

# ============================================================================
header "6. API ROUTE SOURCE INSPECTION"
# ============================================================================

echo -e "  ${BOLD}Looking for /api/water-data route handler...${NC}"
API_FILE=$(find . -path "*/api/water-data*" -name "*.ts" -o -path "*/api/water-data*" -name "*.js" | grep -v node_modules | head -5)
if [ -n "$API_FILE" ]; then
  pass "Found API route(s):"
  echo "$API_FILE" | sed 's/^/    /'
  echo ""
  
  for f in $API_FILE; do
    LINES=$(wc -l < "$f")
    info "$f: $LINES lines"
    
    # Check for try/catch
    TC=$(grep -c "try\s*{" "$f" 2>/dev/null || echo "0")
    if [ "$TC" -gt 0 ]; then
      pass "Has $TC try/catch block(s)"
    else
      fail "NO try/catch found — unhandled errors cause 502s"
    fi
    
    # Check for timeout handling
    if grep -q "timeout\|AbortController\|signal\|setTimeout" "$f" 2>/dev/null; then
      pass "Has timeout/abort handling"
    else
      warn "No timeout handling found — long upstream calls can 502"
    fi
    
    # Check for mmw-latest handler
    if grep -q "mmw-latest\|mmw" "$f" 2>/dev/null; then
      info "mmw-latest action handler found"
      grep -n "mmw" "$f" | head -5 | sed 's/^/      /'
    else
      warn "No mmw-latest handler found in this file"
    fi
    
    # Check for coops handler
    if grep -q "coops\|co-ops\|tidesandcurrents" "$f" 2>/dev/null; then
      info "NOAA CO-OPS handler found"
      grep -n "coops\|tidesandcurrents" "$f" | head -5 | sed 's/^/      /'
    else
      warn "No NOAA CO-OPS handler found in this file"
    fi
    echo ""
  done
else
  fail "Could not find /api/water-data route file"
  info "Expected at: app/api/water-data/route.ts or pages/api/water-data.ts"
  find . -path "*/api/*water*" -not -path "*/node_modules/*" 2>/dev/null | sed 's/^/    /'
fi

# ============================================================================
header "7. useWaterData.ts ERROR HANDLING CHECK"
# ============================================================================

echo -e "  ${BOLD}Inspecting useWaterData.ts (lines 1318 and 1487 from log)...${NC}"
UWD=$(find . -name "useWaterData.ts" -not -path "*/node_modules/*" 2>/dev/null | head -1)
if [ -n "$UWD" ]; then
  pass "Found: $UWD"
  LINES=$(wc -l < "$UWD")
  info "$LINES total lines"
  
  # Show context around the failing lines
  echo ""
  echo -e "  ${BOLD}Line ~1318 context (mmw-latest fetch):${NC}"
  sed -n '1310,1330p' "$UWD" 2>/dev/null | cat -n | sed 's/^/    /'
  
  echo ""
  echo -e "  ${BOLD}Line ~1487 context (coops-product fetch):${NC}"
  sed -n '1479,1499p' "$UWD" 2>/dev/null | cat -n | sed 's/^/    /'
  
  # Check retry logic
  echo ""
  if grep -q "retry\|retries\|attempts" "$UWD" 2>/dev/null; then
    pass "Has retry logic"
  else
    warn "No retry logic found — failed fetches are one-and-done"
  fi
  
  # Check error handling
  if grep -q "\.catch\|try.*catch" "$UWD" 2>/dev/null; then
    TC=$(grep -c "\.catch\|catch\s*(" "$UWD" 2>/dev/null || echo "0")
    info "$TC catch handlers found"
  else
    fail "No .catch or try/catch found — errors propagate unhandled"
  fi
else
  fail "useWaterData.ts not found"
fi

# ============================================================================
header "8. QUICK ENV & DEPS CHECK"
# ============================================================================

echo -e "  ${BOLD}Node version:${NC}"
node -v 2>/dev/null | sed 's/^/    /' || warn "Node not found"

echo -e "  ${BOLD}Next.js version:${NC}"
if [ -f "package.json" ]; then
  grep '"next"' package.json | sed 's/^/    /'
fi

echo -e "  ${BOLD}Checking .env files for API keys...${NC}"
for envfile in .env .env.local .env.development .env.development.local; do
  if [ -f "$envfile" ]; then
    info "$envfile exists"
    # Check for relevant API keys without printing values
    for key in NOAA API_KEY WATER MMW WATERSHED COOPS; do
      if grep -qi "$key" "$envfile" 2>/dev/null; then
        VARNAME=$(grep -i "$key" "$envfile" | head -1 | cut -d'=' -f1)
        VARVAL=$(grep -i "$key" "$envfile" | head -1 | cut -d'=' -f2)
        if [ -n "$VARVAL" ] && [ "$VARVAL" != '""' ] && [ "$VARVAL" != "''" ]; then
          pass "$VARNAME is set (${#VARVAL} chars)"
        else
          fail "$VARNAME is EMPTY"
        fi
      fi
    done
  fi
done

# ============================================================================
header "9. NEXT.JS SERVER LOG TAIL"
# ============================================================================

echo -e "  ${BOLD}Checking for server-side error logs...${NC}"
if [ -f ".next/trace" ]; then
  info ".next/trace exists ($(du -sh .next/trace | cut -f1))"
fi

# Check if there are any recent crash logs
CRASH_LOGS=$(find . -name "*.log" -newer package.json -not -path "*/node_modules/*" 2>/dev/null | head -5)
if [ -n "$CRASH_LOGS" ]; then
  info "Recent log files:"
  echo "$CRASH_LOGS" | sed 's/^/    /'
fi

echo -e "\n  ${YELLOW}TIP: Run your dev server in a separate terminal and watch for${NC}"
echo -e "  ${YELLOW}server-side errors. The 502s will show the real error there:${NC}"
echo -e "  ${DIM}    npm run dev 2>&1 | tee server.log${NC}"
echo -e "  ${DIM}    # Then trigger the page load in browser${NC}"
echo -e "  ${DIM}    # Check server.log for the actual stack trace${NC}"

# ============================================================================
header "RESULTS SUMMARY"
# ============================================================================

echo -e "  ${GREEN}✔ Passed: $PASS${NC}"
echo -e "  ${RED}✘ Failed: $FAIL${NC}"
echo -e "  ${YELLOW}⚠ Warnings: $WARN${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}ACTION ITEMS:${NC}"
  echo -e "  ${RED}1. Check /api/water-data route for unhandled errors (causes 502)${NC}"
  echo -e "  ${RED}2. Test upstream APIs directly (section 3 above)${NC}"
  echo -e "  ${RED}3. Add try/catch + timeout to API route if missing${NC}"
  echo -e "  ${RED}4. Fix duplicate keys in LeafletMapShell (use assessmentUnitId)${NC}"
  echo ""
fi

echo -e "  ${DIM}Temp files in /tmp/pin-*.json — inspect for response details${NC}"
echo -e "  ${DIM}Run: cat /tmp/pin-mmw.json | python3 -m json.tool${NC}"
echo ""

# Cleanup
rm -f /tmp/pin-mmw.json /tmp/pin-mmw2.json /tmp/pin-coops.json \
      /tmp/pin-noaa-direct.json /tmp/pin-attains-direct.json \
      /tmp/pin-usgs-direct.json /tmp/pin-mmw-direct.json 2>/dev/null
