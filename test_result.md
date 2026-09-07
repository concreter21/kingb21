#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Incorporate The Kitchenary risk-assessment spreadsheet (rt.xlsx) as ready-made risk assessment templates users can pick and fill, and as a preset hazard/controls library the AI draws from during assessments."

backend:
  - task: "Risk template endpoints (list + detail)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/risk-templates returns 8 templates; GET /api/risk-templates/{id} returns full hazards. Verified via curl."
  - task: "AI assess template grounding + template_id"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "POST /api/ai/assess accepts optional template_id; run_ai injects company HAZARD_LIBRARY for risk/swms/density and the selected template as authoritative baseline. Template-only (no image) generation works — verified Slicer returned company-aligned hazards. Ensure existing photo-based assess (no template) still works (regression)."

frontend:
  - task: "Template picker on Assess screen (Risk/SWMS)"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/assess.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Template selector chip + bottom-sheet modal listing 8 templates; select shows chip with clear (x); GENERATE FROM TEMPLATE (NO PHOTO) button appears when a template is selected. Verified via screenshots."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 12
  run_ui: false

test_plan:
  current_focus:
    - "Risk template endpoints (list + detail)"
    - "AI assess template grounding + template_id"
    - "Template picker on Assess screen (Risk/SWMS)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Implemented risk templates + AI hazard library. Login field is 'token'. Owner password owner1234 no longer works — use safety@tk.com/test1234. Please test the 3 new/changed items and confirm existing photo-based assessments still work (regression). Avoid excessive Gemini calls: 1-2 AI assess calls are enough."

  - task: "Email assessment report to a recipient (POST /api/assessments/{id}/email)"
    implemented: true
    working: "NA"
    file: "backend/server.py, backend/email_util.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New endpoint emails a server-side-rendered HTML report (assessment_report_html) via Resend. Auth + visibility check + EmailStr validation + per-user rate limit (15/hr). Verified via curl: send to delivered@resend.dev returns {ok:true,email_id}, invalid email -> 422, unknown id -> 404."

  - task: "Global floating Help/Support FAB on all tabs"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/_layout.tsx, frontend/src/components/SupportFab.tsx, frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Moved the support FAB from Home into the tabs layout so it renders on every tab (Home/Assess/LOTO/Access/Profile). On the Assess tab it is lifted above the capture bar to avoid overlap. Verified via screenshots."

  - task: "Email recipient box above Export PDF on assessment detail"
    implemented: true
    working: "NA"
    file: "frontend/app/assessment/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added 'EMAIL THIS REPORT' input + send button above the EXPORT PDF button; validates email, shows sent/error state. Verified via screenshot."