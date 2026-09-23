# GitHub Community Onboarding & Automation Architecture
**Modeled on Hack Club's Onboarding Engine for Evergreeners**

---

## Executive Summary

To build an active, enduring open-source community around **Evergreeners**, we need a low-friction, high-delight onboarding pipeline. Traditional open-source repositories suffer from a steep onboarding curve: new developers must find an issue, configure local environments, understand complex test suites, and face the anxiety of having their first pull request scrutinized or rejected.

**Hack Club** solved this problem and built one of the world's most active developer communities by turning the "First Pull Request" into a celebratory rite of passage rather than a technical exam.

This document details:
1. The architectural principles behind Hack Club's onboarding and organization management.
2. The Evergreeners adaptation: **The Seedling Architecture**.
3. The end-to-end user journey from Web Signup to Org Invitation, First PR, and Streak Initialization.

---

## 1. The Hack Club Playbook Deconstructed

Hack Club’s onboarding machine relies on three core pillars:

```
┌─────────────────────────────────────────────────────────────┐
│                 Hack Club Onboarding Model                  │
├──────────────────────────────┬──────────────────────────────┤
│ 1. Rite of Passage           │ 2. Dual-Org Architecture     │
│    • "Draw a Dino"           │    • @hackclub (Production)  │
│    • hackclub/dinosaurs      │    • @hackclub-community     │
│    • Zero technical risk     │    • Permission isolation    │
├──────────────────────────────┴──────────────────────────────┤
│ 3. Automated API Gateways                                   │
│    • Web Auth & Slack Bot Gateways (Toriel, Slacker)        │
│    • Automated org invites via GitHub REST API              │
└─────────────────────────────────────────────────────────────┘
```

### Pillar A: The "First PR" Rite of Passage (`hackclub/dinosaurs`)
* **The Concept**: Every new member is invited to draw "Prophet Orpheus" (their dinosaur mascot) using MS Paint, Pinta, or any simple drawing tool.
* **The Mechanics**:
  1. Member follows a step-by-step 5-minute visual guide (`hack.af/make-dino`).
  2. Member forks `hackclub/dinosaurs`.
  3. Uploads their image file (`<username>_<name>.png`).
  4. Appends their entry to `README.md`.
  5. Opens a Pull Request to `main`.
* **The Magic**:
  * **Zero Impostor Syndrome**: Nobody's drawing is "wrong" or fails a unit test.
  * **Core Skills Acquired**: The member learns forks, branches, commits, markdown, and PRs in a safe environment.
  * **Instant Gratification**: Automated workflows and welcoming maintainers merge the PR quickly. The art is deployed automatically to `rawr.hackclub.com`, and the user is celebrated with a digital dino badge.

### Pillar B: Dual-Organization Architecture
GitHub organization membership gives members visibility and community identity, but granting organization-wide access poses security risks. Hack Club balances this with a dual-organization structure:
* **`@hackclub`**: Restricted to core staff, financial infrastructure (Hack Club Bank / HCB), and production systems.
* **`@hackclub-community`**: A wide-open playground where community members are granted membership, can form teams, spin up shared repositories, and collaborate without posing a threat to production services.

### Pillar C: Automated Identity & API Gateways
Because GitHub does not offer a native public "Join Organization" button, Hack Club bridges communication channels:
* Signups through web forms or Slack invite gateways trigger automated backend scripts.
* Using tokens with `admin:org` permissions, GitHub API endpoints (`POST /orgs/{org}/invitations` or `PUT /orgs/{org}/memberships/{username}`) programmatically dispatch invites directly to members' GitHub handles.

---

## 2. The Evergreeners Adaptation: "The Seedling Architecture"

In Evergreeners, our mission is: **"Track your consistency. Grow your legacy. Stay evergreen 🌲"**.

We map Hack Club's proven onboarding engine to the Evergreeners domain model:

| Hack Club Concept | Evergreeners Equivalent | Domain Term (from CONTEXT.md) |
| :--- | :--- | :--- |
| Prophet Orpheus (Dinosaur) | **The Seedling** (Evergreen Tree / Sprout) | Digital Garden Asset |
| New Member | **Gardener** | Gardener |
| `hackclub/dinosaurs` | `evergreeners/welcome-seedlings` | Onboarding Repository |
| Dinosaur Gallery (`rawr.hackclub.com`) | **Community Garden** | Garden Showcase |
| Dino Badge | **First Seedling Badge** | Badge |
| Slack Welcome Gateways | **Better Auth OAuth + API Inviter** | Identity Integration |

### High-Level User Journey

```mermaid
sequenceDiagram
    autonumber
    actor Gardener
    participant Web as Evergreeners Web (React)
    participant API as Backend (Fastify + Better Auth)
    participant GH_API as GitHub API
    participant Seedlings as evergreeners/welcome-seedlings
    participant DB as Postgres (Supabase)

    Gardener->>Web: Clicks "Sign in with GitHub"
    Web->>API: OAuth Callback & Profile Exchange
    API->>DB: Create User Record (isGithubConnected = true)
    API->>GH_API: PUT /orgs/evergreeners/memberships/{username}
    GH_API-->>Gardener: GitHub Org Invitation Email & Notification
    API->>Gardener: Welcome Email with Onboarding Quest link
    Web->>Gardener: Redirects to /dashboard (Shows "Accept Org Invite" Banner)
    Gardener->>GH_API: Accepts invitation at github.com/orgs/evergreeners/invitation
    Gardener->>Seedlings: Forks repo, plants Seedling (seedlings/<username>.md)
    Gardener->>Seedlings: Opens "First PR"
    Seedlings-->>Seedlings: GitHub Action validates & merges PR
    Seedlings->>API: Webhook / Quest check verifies merge
    API->>DB: Award "First Seedling" Badge & initialize Streak
    API-->>Web: Gardener profile displays Badge & active Garden
```

---

## 3. Technical Implementation Specifications

### A. Backend Org-Invite Pipeline (`server/src/auth.ts`)

When a Gardener creates an account via GitHub OAuth, Better Auth triggers the `databaseHooks.user.create.after` lifecycle hook. We dispatch an invitation immediately.

#### 1. Credential Configuration
In `server/.env`:
```env
# Fine-grained PAT or GitHub App token with Organization Permissions:
# - Members: Read and write
# - Organization administration: Read-only
GITHUB_ORG_ADMIN_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GITHUB_COMMUNITY_ORG="evergreeners"
```

#### 2. Hook Implementation
```typescript
// server/src/auth.ts
import { Octokit } from "octokit";

const octokit = process.env.GITHUB_ORG_ADMIN_TOKEN
    ? new Octokit({ auth: process.env.GITHUB_ORG_ADMIN_TOKEN })
    : null;

export const auth = betterAuth({
    // ...existing config...
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    const isGithubConnected = !!(user as any).isGithubConnected;
                    const username = (user as any).username;

                    // 1. Fire-and-forget welcome email
                    if (user.email) {
                        sendWelcomeEmail(
                            user.email,
                            user.name || username || "Gardener",
                            isGithubConnected
                        ).catch(err => console.error("[Email] Welcome email failed:", err));
                    }

                    // 2. Automated GitHub Organization Invitation
                    if (octokit && isGithubConnected && username) {
                        try {
                            const org = process.env.GITHUB_COMMUNITY_ORG || "evergreeners";
                            await octokit.rest.orgs.setMembershipForUser({
                                org,
                                username,
                                role: "member",
                            });
                            console.log(`[Org Invite] Sent invitation to ${username} for @${org}`);
                        } catch (err: any) {
                            // 422 indicates user is already a member or invited
                            if (err.status === 422) {
                                console.log(`[Org Invite] User ${username} already invited or member.`);
                            } else {
                                console.error(`[Org Invite] Failed to invite ${username}:`, err.message);
                            }
                        }
                    }
                }
            }
        }
    }
});
```

---

### B. The `evergreeners/welcome-seedlings` Repository

Modelled directly on Hack Club’s `hackclub/dinosaurs`, this dedicated repository acts as the interactive proving ground.

#### Repository Architecture
```text
evergreeners/welcome-seedlings/
├── README.md                           # Tutorial & live gallery of seedlings
├── seedlings/
│   ├── .gitkeep
│   ├── adams-404.md                    # Example seedling file
│   └── <username>.md                   # New contributors add their file here
├── assets/
│   └── templates/
│       ├── pine.txt                    # ASCII art tree options
│       ├── oak.txt
│       └── bonsai.txt
└── .github/
    └── workflows/
        └── seedling-onboarding.yml     # Auto-validator and merge bot
```

#### Seedling File Format (`seedlings/<username>.md`)
```markdown
---
gardener: "your-github-username"
planted_at: "YYYY-MM-DD"
tree_type: "Evergreen Pine"
consistency_goal: "Code 30 minutes every day before work"
favorite_stack: ["TypeScript", "React", "PostgreSQL"]
---

### 🌲 My Seedling

\`\`\`
       /\\
      /  \\
     / /\\ \\
    / /  \\ \\
   /_/ /\\ \\_\\
     / /\\ \\
    / /  \\ \\
   /_/__\\_\\_\\
      ||||
      ||||
\`\`\`

> "Consistency is not about perfection; it is about persistence."
```

#### Automated Pull Request Workflow (`.github/workflows/seedling-onboarding.yml`)
The repository contains an automated GitHub Action that enforces safety while providing instant validation and auto-merging:

```yaml
name: Seedling Onboarding Bot

on:
  pull_request_target:
    types: [opened, synchronize]
    paths:
      - 'seedlings/**.md'

permissions:
  pull-requests: write
  contents: write

jobs:
  validate-and-welcome:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Validate PR Structure
        id: check-files
        run: |
          AUTHOR="${{ github.event.pull_request.user.login }}"
          EXPECTED_FILE="seedlings/${AUTHOR,,}.md"
          
          # Ensure PR only touches their own file
          CHANGED_FILES=$(gh pr diff ${{ github.event.pull_request.number }} --name-only)
          echo "Files changed: $CHANGED_FILES"
          
          for file in $CHANGED_FILES; do
            if [[ "${file,,}" != "$EXPECTED_FILE" ]]; then
              echo "Error: PR modifies unexpected file: $file"
              exit 1
            fi
          done
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Welcome Comment
        uses: actions/github-script@v7
        with:
          script: |
            const author = context.payload.pull_request.user.login;
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.pull_request.number,
              body: `🌱 Welcome to the Evergreeners garden, @${author}!\n\nYour seedling has taken root. Our bot is auto-merging your contribution now.`
            });

      - name: Auto-Merge
        run: |
          gh pr merge ${{ github.event.pull_request.number }} --squash --delete-branch
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### C. Frontend In-App Invitation Banner

GitHub invitations are not auto-accepted; users must accept them at `https://github.com/orgs/evergreeners/invitation`.

To bridge the gap between signup and acceptance, the Evergreeners dashboard displays an actionable status banner:

```tsx
// src/components/OrgInviteBanner.tsx
import React, { useEffect, useState } from "react";
import { CheckCircle2, ArrowRight, TreePine, ExternalLink } from "lucide-react";

export const OrgInviteBanner: React.FC<{ username: string }> = ({ username }) => {
  const [membershipStatus, setMembershipStatus] = useState<"pending" | "active" | "unknown">("unknown");

  useEffect(() => {
    fetch(`/api/user/org-membership-status`)
      .then(res => res.json())
      .then(data => setMembershipStatus(data.status))
      .catch(() => setMembershipStatus("unknown"));
  }, []);

  if (membershipStatus !== "pending") return null;

  return (
    <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
          <TreePine className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-emerald-100">
            Join the Evergreeners GitHub Community
          </h4>
          <p className="text-xs text-emerald-300/80">
            An invitation was sent to your GitHub account (@{username}). Accept it to showcase the Evergreeners badge!
          </p>
        </div>
      </div>
      <a
        href="https://github.com/orgs/evergreeners/invitation"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
      >
        Accept Invitation
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
};
```

