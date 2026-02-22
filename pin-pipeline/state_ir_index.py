#!/usr/bin/env python3
"""
PIN State Integrated Report Collection Index
=============================================
Every US state + DC + territories: CWA 305(b)/303(d) Integrated Reports

This is the master index for the report extraction pipeline.
Each entry contains:
  - state code, name, agency
  - integrated report page URL (where reports are published)
  - direct PDF URL for most recent report (where known)
  - reporting cycle (2024 or 2022 — biennial)
  - EPA approval date (where confirmed)
  - data window (monitoring period covered)
  - supplemental report URLs (TMDLs, special studies, CCRs)
  - status: confirmed | probable | needs_verification

Usage:
  python state_ir_index.py --list           # Print all states and status
  python state_ir_index.py --check <ST>     # Check specific state
  python state_ir_index.py --export json    # Export full index as JSON
  python state_ir_index.py --stale          # Show states with oldest data
  python state_ir_index.py --download <ST>  # Download report PDF

Run with --verify to HTTP HEAD check all URLs and flag dead links.
"""

import json
import sys
import os
from datetime import datetime
from typing import Optional

# =============================================================================
# MASTER INDEX — All 56 Jurisdictions
# =============================================================================
# Reporting cycles are biennial (even years): 2024, 2022, 2020, etc.
# Most states are on the 2024 cycle; some lag on 2022 or earlier.
# "ir_page" = state's integrated report landing page
# "ir_pdf" = direct PDF link to most recent report (if available)
# "epa_approval" = date EPA approved the most recent IR
# "data_window" = monitoring data period covered by the report
# "supplemental" = additional report types available from this state
# =============================================================================

STATE_IR_INDEX = [
    # =========================================================================
    # REGION 1 — New England
    # =========================================================================
    {
        "state_code": "CT",
        "state_name": "Connecticut",
        "agency": "Department of Energy and Environmental Protection (DEEP)",
        "ir_page": "https://portal.ct.gov/DEEP/Water/Water-Quality/Water-Quality-305b-Report-to-Congress",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": "2017-2022",
        "status": "needs_verification",
        "supplemental": ["TMDL documents", "Beach monitoring"],
        "notes": "CT publishes separate 303(d) and 305(b) reports in some cycles"
    },
    {
        "state_code": "ME",
        "state_name": "Maine",
        "agency": "Department of Environmental Protection (DEP)",
        "ir_page": "https://www.maine.gov/dep/water/monitoring/305b/index.html",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["River/stream biomonitoring", "Lake assessment"],
        "notes": ""
    },
    {
        "state_code": "MA",
        "state_name": "Massachusetts",
        "agency": "Department of Environmental Protection (MassDEP)",
        "ir_page": "https://www.mass.gov/service-details/water-quality-assessments",
        "ir_pdf": "https://www.epa.gov/system/files/documents/2023-10/2022-ma-303d-list-report.pdf",
        "latest_cycle": "2022",
        "epa_approval": "2023-10",
        "data_window": "2016-2021",
        "status": "confirmed",
        "supplemental": ["CALM methodology", "Probabilistic stream surveys", "Lake trophic studies"],
        "notes": "2024 cycle likely in progress; 2022 report confirmed on EPA site"
    },
    {
        "state_code": "NH",
        "state_name": "New Hampshire",
        "agency": "Department of Environmental Services (DES)",
        "ir_page": "https://www.des.nh.gov/water/rivers-and-lakes/water-quality-assessment",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Volunteer lake assessment program (VLAP)"],
        "notes": ""
    },
    {
        "state_code": "RI",
        "state_name": "Rhode Island",
        "agency": "Department of Environmental Management (DEM)",
        "ir_page": "https://dem.ri.gov/programs/water/quality/surface-water/integrated-report.php",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Narragansett Bay water quality", "Beach monitoring"],
        "notes": ""
    },
    {
        "state_code": "VT",
        "state_name": "Vermont",
        "agency": "Department of Environmental Conservation (DEC)",
        "ir_page": "https://dec.vermont.gov/water-investment/water-quality/assessment",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Lake Champlain TMDL", "Tactical basin plans"],
        "notes": "VT uses tactical basin plans as supplemental assessment documents"
    },

    # =========================================================================
    # REGION 2 — NY, NJ, PR, USVI
    # =========================================================================
    {
        "state_code": "NJ",
        "state_name": "New Jersey",
        "agency": "Department of Environmental Protection (NJDEP)",
        "ir_page": "https://www.nj.gov/dep/wms/bears/assessment.htm",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["PFAS monitoring", "Combined sewer overflow reports"],
        "notes": ""
    },
    {
        "state_code": "NY",
        "state_name": "New York",
        "agency": "Department of Environmental Conservation (DEC)",
        "ir_page": "https://www.dec.ny.gov/chemical/36730.html",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Waterbody inventory", "Rotating basin assessments", "Great Lakes monitoring"],
        "notes": "NY publishes Priority Waterbodies List (PWL) as supplement"
    },
    {
        "state_code": "PR",
        "state_name": "Puerto Rico",
        "agency": "Environmental Quality Board (JCA)",
        "ir_page": "https://www.jca.pr.gov/",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": "PR has historically lagged on IR submissions"
    },
    {
        "state_code": "VI",
        "state_name": "US Virgin Islands",
        "agency": "Department of Planning and Natural Resources (DPNR)",
        "ir_page": "https://dpnr.vi.gov/",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Coral reef monitoring"],
        "notes": ""
    },

    # =========================================================================
    # REGION 3 — Mid-Atlantic
    # =========================================================================
    {
        "state_code": "DE",
        "state_name": "Delaware",
        "agency": "Department of Natural Resources and Environmental Control (DNREC)",
        "ir_page": "https://dnrec.delaware.gov/water/assessment/",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Inland Bays monitoring", "Watershed assessment reports"],
        "notes": ""
    },
    {
        "state_code": "DC",
        "state_name": "District of Columbia",
        "agency": "Department of Energy and Environment (DOEE)",
        "ir_page": "https://doee.dc.gov/service/water-quality-assessments",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Anacostia monitoring", "Potomac monitoring"],
        "notes": "Critical for Potomac Interceptor work"
    },
    {
        "state_code": "MD",
        "state_name": "Maryland",
        "agency": "Department of the Environment (MDE)",
        "ir_page": "https://mde.maryland.gov/programs/water/TMDL/Integrated303dReports/Pages/2024IR.aspx",
        "ir_pdf": "https://mde.maryland.gov/programs/water/TMDL/Integrated303dReports/Documents/Integrated_Report_Section_PDFs/IR_2024/MD%202024%20Final%20IR%209_4_24.pdf",
        "latest_cycle": "2024",
        "epa_approval": "2024-09-04",
        "data_window": "2018-2023",
        "status": "confirmed",
        "supplemental": [
            "Eyes on the Bay (eyesonthebay.dnr.maryland.gov) — real-time tidal monitoring",
            "Chesapeake Bay Program monitoring",
            "TMDL implementation plans",
            "MDE AWQMS database",
            "2026 IR data solicitation now open"
        ],
        "notes": "HOME STATE — highest priority. EPA approved Sept 4, 2024. 134 impaired watersheds, 850+ potential TMDLs. MDE soliciting data for 2026 cycle NOW."
    },
    {
        "state_code": "PA",
        "state_name": "Pennsylvania",
        "agency": "Department of Environmental Protection (DEP)",
        "ir_page": "https://www.dep.pa.gov/Business/Water/CleanWater/WaterQuality/IntegratedReport/Pages/default.aspx",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Acid mine drainage reports", "Chesapeake Bay tributary strategy"],
        "notes": "PA has large volume of AMD-impaired waters"
    },
    {
        "state_code": "VA",
        "state_name": "Virginia",
        "agency": "Department of Environmental Quality (DEQ)",
        "ir_page": "https://www.deq.virginia.gov/water/water-quality/assessments/integrated-report",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": "2025-07-28",
        "data_window": "2017-2022",
        "status": "confirmed",
        "supplemental": ["Chesapeake Bay TMDL WIPs", "Water quality standards"],
        "notes": "2024 IR approved July 28, 2025. Data window Jan 2017 - Dec 2022."
    },
    {
        "state_code": "WV",
        "state_name": "West Virginia",
        "agency": "Department of Environmental Protection (DEP)",
        "ir_page": "https://dep.wv.gov/WWE/watershed/IR/Pages/default.aspx",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["AMD treatment reports"],
        "notes": ""
    },

    # =========================================================================
    # REGION 4 — Southeast
    # =========================================================================
    {
        "state_code": "AL",
        "state_name": "Alabama",
        "agency": "Department of Environmental Management (ADEM)",
        "ir_page": "https://adem.alabama.gov/programs/water/wquality/305b.cnt",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "FL",
        "state_name": "Florida",
        "agency": "Department of Environmental Protection (DEP)",
        "ir_page": "https://floridadep.gov/dear/water-quality-assessment",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [
            "DBHYDRO database (already in pipeline)",
            "Protecting Florida Together dashboard",
            "HAB monitoring reports",
            "Springs monitoring",
            "Coral reef monitoring"
        ],
        "notes": "FL DBHYDRO already in PIN pipeline. IR supplements with assessment decisions."
    },
    {
        "state_code": "GA",
        "state_name": "Georgia",
        "agency": "Environmental Protection Division (EPD)",
        "ir_page": "https://epd.georgia.gov/watershed-protection-branch/water-quality-georgia",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "KY",
        "state_name": "Kentucky",
        "agency": "Energy and Environment Cabinet / Division of Water",
        "ir_page": "https://eec.ky.gov/Environmental-Protection/Water/Monitor/Pages/IntegratedReport.aspx",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "MS",
        "state_name": "Mississippi",
        "agency": "Department of Environmental Quality (MDEQ)",
        "ir_page": "https://www.mdeq.ms.gov/water/field-services/water-quality-assessment/",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "NC",
        "state_name": "North Carolina",
        "agency": "Department of Environmental Quality (DEQ)",
        "ir_page": "https://www.deq.nc.gov/about/divisions/water-resources/water-planning/classification-standards/integrated-report",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Basinwide water quality plans"],
        "notes": ""
    },
    {
        "state_code": "SC",
        "state_name": "South Carolina",
        "agency": "Department of Health and Environmental Control (DHEC) / Dept. of Environmental Services",
        "ir_page": "https://scdhec.gov/environment/your-water-coast/water-quality-assessments",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": "DHEC environmental functions transferred to new Dept. of Environmental Services in 2024"
    },
    {
        "state_code": "TN",
        "state_name": "Tennessee",
        "agency": "Department of Environment and Conservation (TDEC)",
        "ir_page": "https://www.tn.gov/environment/program-areas/wr-water-resources/water-quality/water-quality-reports---publications.html",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },

    # =========================================================================
    # REGION 5 — Great Lakes
    # =========================================================================
    {
        "state_code": "IL",
        "state_name": "Illinois",
        "agency": "Environmental Protection Agency (IEPA)",
        "ir_page": "https://epa.illinois.gov/topics/water-quality/monitoring/surface-water/integrated-report.html",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Lake Michigan monitoring"],
        "notes": ""
    },
    {
        "state_code": "IN",
        "state_name": "Indiana",
        "agency": "Department of Environmental Management (IDEM)",
        "ir_page": "https://www.in.gov/idem/nps/watershed-assessment/water-quality-assessments-and-reporting/integrated-water-monitoring-and-assessment-report/",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": "2024-05-17",
        "data_window": None,
        "status": "confirmed",
        "supplemental": ["Lake trophic status", "Aquatic life use assessments", "CALM methodology"],
        "notes": "2024 IR uploaded to ATTAINS March 29, 2024. EPA partial approval May 17, 2024."
    },
    {
        "state_code": "MI",
        "state_name": "Michigan",
        "agency": "Department of Environment, Great Lakes, and Energy (EGLE)",
        "ir_page": "https://www.michigan.gov/egle/about/organization/water-resources/assessment-and-management",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Great Lakes monitoring", "PFAS action response team data"],
        "notes": "MI EGLE has extensive PFAS monitoring data"
    },
    {
        "state_code": "MN",
        "state_name": "Minnesota",
        "agency": "Pollution Control Agency (MPCA)",
        "ir_page": "https://www.pca.state.mn.us/water/water-quality-and-pollutants/impaired-waters-and-tmdls",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Watershed condition assessments", "Lake water quality reports"],
        "notes": "MN does intensive watershed monitoring on rotating schedule"
    },
    {
        "state_code": "OH",
        "state_name": "Ohio",
        "agency": "Environmental Protection Agency (Ohio EPA)",
        "ir_page": "https://epa.ohio.gov/divisions-and-offices/surface-water/reports-data/integrated-report",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Biological surveys", "HAB monitoring (Lake Erie)"],
        "notes": "Ohio EPA biological surveys contain rich WQ data not always in WQP"
    },
    {
        "state_code": "WI",
        "state_name": "Wisconsin",
        "agency": "Department of Natural Resources (DNR)",
        "ir_page": "https://dnr.wisconsin.gov/topic/SurfaceWater/assessments",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Great Lakes monitoring"],
        "notes": ""
    },

    # =========================================================================
    # REGION 6 — South Central
    # =========================================================================
    {
        "state_code": "AR",
        "state_name": "Arkansas",
        "agency": "Division of Environmental Quality (DEQ)",
        "ir_page": "https://www.adeq.state.ar.us/water/planning/integrated/",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "LA",
        "state_name": "Louisiana",
        "agency": "Department of Environmental Quality (LDEQ)",
        "ir_page": "https://www.deq.louisiana.gov/page/water-quality-integrated-report-305b303d",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Hypoxia monitoring (Gulf dead zone)"],
        "notes": ""
    },
    {
        "state_code": "NM",
        "state_name": "New Mexico",
        "agency": "Environment Department (NMED)",
        "ir_page": "https://www.env.nm.gov/surface-water-quality/303d-305b/",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "OK",
        "state_name": "Oklahoma",
        "agency": "Department of Environmental Quality (DEQ)",
        "ir_page": "https://www.deq.ok.gov/water-quality-division/watershed-planning/integrated-report/",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Beneficial use monitoring program"],
        "notes": ""
    },
    {
        "state_code": "TX",
        "state_name": "Texas",
        "agency": "Commission on Environmental Quality (TCEQ)",
        "ir_page": "https://www.tceq.texas.gov/waterquality/assessment",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Clean Rivers Program data", "Surface water quality monitoring"],
        "notes": "TX TCEQ already in pipeline for monitoring data; IR supplements with assessment decisions"
    },

    # =========================================================================
    # REGION 7 — Midwest
    # =========================================================================
    {
        "state_code": "IA",
        "state_name": "Iowa",
        "agency": "Department of Natural Resources (DNR)",
        "ir_page": "https://www.iowadnr.gov/Environmental-Protection/Water-Quality/Water-Monitoring/Impaired-Waters",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Nutrient reduction strategy reports"],
        "notes": "Iowa nutrient strategy is major state effort with annual progress reports"
    },
    {
        "state_code": "KS",
        "state_name": "Kansas",
        "agency": "Department of Health and Environment (KDHE)",
        "ir_page": "https://www.kdhe.ks.gov/1583/Integrated-Report",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "MO",
        "state_name": "Missouri",
        "agency": "Department of Natural Resources (DNR)",
        "ir_page": "https://dnr.mo.gov/water/what-were-doing/water-quality-monitoring-assessment/integrated-report",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "NE",
        "state_name": "Nebraska",
        "agency": "Department of Environment and Energy (NDEE)",
        "ir_page": "https://dee.ne.gov/NDEQProg.nsf/OnWeb/IntRep",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },

    # =========================================================================
    # REGION 8 — Mountain West
    # =========================================================================
    {
        "state_code": "CO",
        "state_name": "Colorado",
        "agency": "Department of Public Health and Environment (CDPHE)",
        "ir_page": "https://cdphe.colorado.gov/water-quality-control-commission/integrated-report",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Regulation 93 listings"],
        "notes": ""
    },
    {
        "state_code": "MT",
        "state_name": "Montana",
        "agency": "Department of Environmental Quality (DEQ)",
        "ir_page": "https://deq.mt.gov/water/Surfacewater/IntegratedReport",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "ND",
        "state_name": "North Dakota",
        "agency": "Department of Environmental Quality (NDDEQ)",
        "ir_page": "https://deq.nd.gov/publications/WQ/3_WM/IntegratedReport/IntegratedReport.aspx",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "SD",
        "state_name": "South Dakota",
        "agency": "Department of Agriculture and Natural Resources (DANR)",
        "ir_page": "https://danr.sd.gov/Environment/WaterQuality/SurfaceWaterQuality/default.aspx",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "UT",
        "state_name": "Utah",
        "agency": "Department of Environmental Quality (DEQ)",
        "ir_page": "https://deq.utah.gov/water-quality/integrated-report",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Great Salt Lake monitoring"],
        "notes": ""
    },
    {
        "state_code": "WY",
        "state_name": "Wyoming",
        "agency": "Department of Environmental Quality (DEQ)",
        "ir_page": "https://deq.wyoming.gov/water-quality/surface-water-quality/integrated-report/",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },

    # =========================================================================
    # REGION 9 — Pacific Southwest
    # =========================================================================
    {
        "state_code": "AZ",
        "state_name": "Arizona",
        "agency": "Department of Environmental Quality (ADEQ)",
        "ir_page": "https://www.azdeq.gov/2022-303d-list-and-305b-assessment",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "CA",
        "state_name": "California",
        "agency": "State Water Resources Control Board (SWRCB)",
        "ir_page": "https://www.waterboards.ca.gov/water_issues/programs/water_quality_assessment/",
        "ir_pdf": "https://www.waterboards.ca.gov/water_issues/programs/tmdl/2023_2024state_ir_reports/2024-integrated-report-final-staff-report.pdf",
        "latest_cycle": "2024",
        "epa_approval": "2024-12-12",
        "data_window": "varies by regional board — SF Bay/LA/Santa Ana on-cycle; data cutoff Oct 2020",
        "status": "confirmed",
        "supplemental": [
            "CEDEN (already in pipeline)",
            "Regional Water Board reports",
            "CSCI bioassessment data",
            "636 new waterbody-pollutant listings in 2024"
        ],
        "notes": "CA rotates regional boards through IR cycles. 2024 covers SF Bay, LA, Santa Ana. EPA partial approval/disapproval Dec 12, 2024."
    },
    {
        "state_code": "HI",
        "state_name": "Hawaii",
        "agency": "Department of Health (DOH) Clean Water Branch",
        "ir_page": "https://health.hawaii.gov/cwb/clean-water-branch-home-page/integrated-report/",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Coral reef monitoring", "Beach monitoring"],
        "notes": ""
    },
    {
        "state_code": "NV",
        "state_name": "Nevada",
        "agency": "Division of Environmental Protection (NDEP)",
        "ir_page": "https://ndep.nv.gov/water/water-quality-data-reporting/integrated-report",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "AS",
        "state_name": "American Samoa",
        "agency": "Environmental Protection Agency (AS-EPA)",
        "ir_page": "https://www.epa.as.gov/",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": "Territory — often delayed on IR submissions"
    },
    {
        "state_code": "GU",
        "state_name": "Guam",
        "agency": "Guam Environmental Protection Agency (GEPA)",
        "ir_page": "https://epa.guam.gov/",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": "Territory"
    },

    # =========================================================================
    # REGION 10 — Pacific Northwest / Alaska
    # =========================================================================
    {
        "state_code": "AK",
        "state_name": "Alaska",
        "agency": "Department of Environmental Conservation (DEC)",
        "ir_page": "https://dec.alaska.gov/water/water-quality/integrated-report/",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "ID",
        "state_name": "Idaho",
        "agency": "Department of Environmental Quality (DEQ)",
        "ir_page": "https://www.deq.idaho.gov/water-quality/surface-water/monitoring-assessment/integrated-report/",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": ""
    },
    {
        "state_code": "OR",
        "state_name": "Oregon",
        "agency": "Department of Environmental Quality (DEQ)",
        "ir_page": "https://www.oregon.gov/deq/wq/Pages/epaApprovedIR.aspx",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Temperature TMDLs", "Willamette basin monitoring"],
        "notes": ""
    },
    {
        "state_code": "WA",
        "state_name": "Washington",
        "agency": "Department of Ecology",
        "ir_page": "https://ecology.wa.gov/water-shorelines/water-quality/water-improvement/assessment-of-water-quality-303d",
        "ir_pdf": None,
        "latest_cycle": "2024",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": ["Water Quality Atlas", "Puget Sound monitoring"],
        "notes": "WA Ecology Water Quality Atlas is excellent supplemental data source"
    },

    # =========================================================================
    # Remaining states not yet categorized above
    # =========================================================================
    {
        "state_code": "MP",
        "state_name": "Northern Mariana Islands",
        "agency": "Bureau of Environmental and Coastal Quality (BECQ)",
        "ir_page": "https://becq.gov.mp/",
        "ir_pdf": None,
        "latest_cycle": "2022",
        "epa_approval": None,
        "data_window": None,
        "status": "needs_verification",
        "supplemental": [],
        "notes": "Territory"
    },
]


# =============================================================================
# SUPPLEMENTAL REPORT TYPES (national-level, not state-specific)
# =============================================================================
SUPPLEMENTAL_NATIONAL = {
    "epa_nars": {
        "name": "National Aquatic Resource Surveys (NARS)",
        "url": "https://www.epa.gov/national-aquatic-resource-surveys",
        "frequency": "Every 5 years per water type",
        "types": ["National Rivers & Streams Assessment", "National Lakes Assessment",
                  "National Coastal Condition Assessment", "National Wetland Condition Assessment"],
        "notes": "Probability-based surveys providing statistically valid national/regional condition estimates"
    },
    "chesapeake_bay_program": {
        "name": "Chesapeake Bay Program Monitoring",
        "url": "https://www.chesapeakebay.net/what/data",
        "frequency": "Continuous + monthly + annual reports",
        "notes": "Already partially in pipeline. Rich supplemental source for MD/VA/PA/DC/DE/WV/NY"
    },
    "great_lakes_monitoring": {
        "name": "Great Lakes Monitoring Programs",
        "url": "https://www.epa.gov/great-lakes-monitoring",
        "frequency": "Annual",
        "notes": "Supplements IL/IN/MI/MN/OH/WI/NY/PA state reports"
    },
    "gulf_hypoxia": {
        "name": "Gulf of Mexico Hypoxia Task Force Reports",
        "url": "https://www.epa.gov/ms-htf",
        "frequency": "Annual",
        "notes": "Dead zone monitoring — supplements LA/MS/TX/AL/FL state reports"
    }
}


# =============================================================================
# CLI Interface
# =============================================================================
def main():
    if len(sys.argv) < 2:
        print_summary()
        return

    cmd = sys.argv[1]

    if cmd == "--list":
        print_summary()
    elif cmd == "--check" and len(sys.argv) > 2:
        check_state(sys.argv[2].upper())
    elif cmd == "--export" and len(sys.argv) > 2:
        export(sys.argv[2])
    elif cmd == "--stale":
        show_stale()
    elif cmd == "--confirmed":
        show_confirmed()
    elif cmd == "--stats":
        show_stats()
    else:
        print(__doc__)


def print_summary():
    print(f"\nPIN State Integrated Report Index")
    print(f"{'='*60}")
    print(f"Total jurisdictions: {len(STATE_IR_INDEX)}")
    confirmed = [s for s in STATE_IR_INDEX if s["status"] == "confirmed"]
    needs_v = [s for s in STATE_IR_INDEX if s["status"] == "needs_verification"]
    print(f"Confirmed (URL + EPA approval verified): {len(confirmed)}")
    print(f"Needs verification: {len(needs_v)}")
    print()
    print(f"{'State':<6} {'Cycle':<8} {'Status':<22} {'EPA Approved':<14}")
    print(f"{'-'*6} {'-'*8} {'-'*22} {'-'*14}")
    for s in sorted(STATE_IR_INDEX, key=lambda x: x["state_code"]):
        print(f"{s['state_code']:<6} {s['latest_cycle']:<8} {s['status']:<22} {s.get('epa_approval') or 'unknown':<14}")


def check_state(code):
    for s in STATE_IR_INDEX:
        if s["state_code"] == code:
            print(json.dumps(s, indent=2))
            return
    print(f"State code {code} not found")


def export(fmt):
    if fmt == "json":
        out = {
            "generated": datetime.now().isoformat(),
            "total_jurisdictions": len(STATE_IR_INDEX),
            "states": STATE_IR_INDEX,
            "supplemental_national": SUPPLEMENTAL_NATIONAL
        }
        path = "state_ir_index.json"
        with open(path, "w") as f:
            json.dump(out, f, indent=2)
        print(f"Exported to {path}")


def show_stale():
    """Show states still on 2022 or earlier cycle"""
    stale = [s for s in STATE_IR_INDEX if s["latest_cycle"] <= "2022"]
    print(f"\nStates on 2022 cycle or earlier ({len(stale)} jurisdictions):")
    print(f"These have the oldest assessment data — highest priority for report extraction\n")
    for s in sorted(stale, key=lambda x: x["latest_cycle"]):
        print(f"  {s['state_code']} - {s['state_name']}: cycle {s['latest_cycle']}")


def show_confirmed():
    confirmed = [s for s in STATE_IR_INDEX if s["status"] == "confirmed"]
    print(f"\nConfirmed states ({len(confirmed)}):")
    for s in confirmed:
        print(f"  {s['state_code']} - {s['state_name']}: cycle {s['latest_cycle']}, approved {s['epa_approval']}")


def show_stats():
    total = len(STATE_IR_INDEX)
    on_2024 = len([s for s in STATE_IR_INDEX if s["latest_cycle"] == "2024"])
    on_2022 = len([s for s in STATE_IR_INDEX if s["latest_cycle"] == "2022"])
    confirmed = len([s for s in STATE_IR_INDEX if s["status"] == "confirmed"])
    with_pdf = len([s for s in STATE_IR_INDEX if s["ir_pdf"]])
    print(f"\n{'='*40}")
    print(f"PIN IR Index Statistics")
    print(f"{'='*40}")
    print(f"Total jurisdictions:    {total}")
    print(f"On 2024 cycle:          {on_2024}")
    print(f"On 2022 cycle:          {on_2022}")
    print(f"EPA approval confirmed: {confirmed}")
    print(f"Direct PDF link known:  {with_pdf}")
    print(f"Needs verification:     {total - confirmed}")


if __name__ == "__main__":
    main()
