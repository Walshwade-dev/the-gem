# Feature Prompt Template

> Use this template to structure all feature specification and implementation prompts for **The Gem: Onion Sales Tracker**. This structured format ensures that any new agent working on the project can understand context, architectural decisions, and boundaries quickly and reliably.

---

## 1. Goal
<!-- State the aim of the prompt: what the user can do on the app when it is fully implemented. Must NOT exceed two sentences. -->
[Describe the user capability and end goal here. Keep it concise and within two sentences.]

---

## 2. Decisions
<!-- The architectural and design choices this prompt relies on, including answers to questions and defaults picked. Each decision MUST take exactly one line / single sentence. -->
- [Decision 1: Choice made or default picked.]
- [Decision 2: State management, storage, or backend pattern chosen.]
- [Decision 3: UI/UX layout or interaction standard applied.]

---

## 3. Out of Scope
<!-- What this prompt deliberately leaves out. Items listed here MUST NOT be implemented, assumed, or guessed by the agent. -->
- [Item 1: Feature or capability deferred to future iterations.]
- [Item 2: Edge-case handling or platform specifics explicitly excluded.]
- [Item 3: Third-party integrations or external services not needed now.]

---

## 4. Steps
<!-- Each step must have a title, full prompt with files and context needed, and the expected state when done.
CRITICAL: Every single step MUST leave the app in a working, compiling state. -->

### Step 1: [Step Title]
- **Files & Context Needed**: [List relevant file paths, stores, types, and components, e.g., `src/store/useAppStore.ts`, `src/types/index.ts`]
- **Prompt**: [Full, specific implementation instructions for this step.]
- **Expected Working State**: [Description of how the app functions after this step and confirmation that `npx tsc --noEmit` compiles cleanly.]

### Step 2: [Step Title]
- **Files & Context Needed**: [List relevant file paths and context]
- **Prompt**: [Full implementation instructions for this step.]
- **Expected Working State**: [Description of how the app functions after this step with zero broken runtime behaviors.]

---

## 5. Verification
<!-- Verification flows, test cases to try, checks to pass, ending with an end-to-end feature check. -->
- **Flow Ran**: [Exact user navigation flow to trigger and test.]
- **Cases to Try**: [Specific input scenarios, edge cases, role switches (Merchant vs. Seller), or dark/light mode toggles.]
- **Checks to Pass**: [List of concrete pass/fail criteria, including clean TypeScript typechecks (`npx tsc --noEmit`) and console check.]
- **End-to-End Feature Check**: [Comprehensive user journey test confirming the primary goal is achieved end-to-end without regressions.]

---

## 6. AGENTS.md Update
<!-- Document any architectural decisions or constraints that later features must respect based on this implementation, organized by section. -->
- **Target Section**: [Name of the section in `AGENTS.md` where these rules belong, e.g., "State Management", "Branding & Styling", "Role Access Control"]
- **Persistent Rules**: [New constraints, guidelines, or design decisions that future agents must follow.]
- **Notes**: [Record any changes or modifications to previously established rules, or write "none" if no existing rules are changed.]
