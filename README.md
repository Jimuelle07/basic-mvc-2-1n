# ASP.NET Core MVC & Git Workshop Guide

A hands-on reference guide for setting up an ASP.NET Core MVC project, working with Git feature branches, opening Pull Requests (PRs), resolving merge conflicts directly on GitHub, and designing portfolio tabs in MVC.

---

## Table of Contents
1. [Project Setup & First Run](#1-project-setup--first-run)
2. [Git Workflow & Feature Branches](#2-git-workflow--feature-branches)
3. [MVC Portfolio Scenario (Two Portfolios, One Project)](#3-mvc-portfolio-scenario-two-portfolios-one-project)
4. [Triggering & Resolving Merge Conflicts in GitHub PR](#4-triggering--resolving-merge-conflicts-in-github-pr)
5. [Understanding the MVC Architecture Behind the Portfolio](#5-understanding-the-mvc-architecture-behind-the-portfolio)

---

## 1. Project Setup & First Run

### Clone and Open Project
Open **Command Prompt**, **PowerShell**, or **Terminal**:

```bash
# 1. Clone remote repository locally
git clone <repo-url.git>

# 2. Navigate to the project folder
cd basic-mvc-2-1n

# 3. Open in VS Code
code .
```

### Initializing the MVC Project (if starting fresh)
1. Install **C# Dev Kit** in Extensions (`Ctrl + Shift + X`).
2. Open Command Palette (`Ctrl + Shift + P`) and select: `.NET: New Project...`
3. Choose template: **ASP.NET Core Web App (Model-View-Controller)**.
4. Enter project name: `JimMvc`.
5. Select current folder and create solution (`.sln`).

### Running the Application
```bash
cd JimMvc
dotnet run
```
Open your browser and navigate to the localhost URL shown in the terminal (e.g., `https://localhost:5001` or `http://localhost:5000`).

---

## 2. Git Workflow & Feature Branches

In team environments, **never push directly to `main`**. Everyone develops on their own feature branch and submits a Pull Request.

```bash
# Check current status
git status

# Create and switch to your feature branch
git checkout -b feature/jim-portfolio
# (or: git switch -c feature/jim-portfolio)

# Stage and commit your changes
git add .
git commit -m "feat: add Jim portfolio action, view, and navbar link"

# Push branch to GitHub
git push -u origin feature/jim-portfolio
```

---

## 3. MVC Portfolio Scenario (Two Portfolios, One Project)

In this workshop exercise, two developers will add their personal portfolio tabs into `Views/Home`.

### Developer 1: Jim's Portfolio (`feature/jim-portfolio`)

#### 1. Add Controller Action in `Controllers/HomeController.cs`:
```csharp
public IActionResult JimPortfolio()
{
    ViewData["Title"] = "Jim's Portfolio";
    return View();
}
```

#### 2. Create View `Views/Home/JimPortfolio.cshtml`:
```html
@{
    ViewData["Title"] = "Jim's Portfolio";
}

<div class="jumbotron text-center p-5 bg-light rounded-3">
    <h1>Hi, I'm Jim! 👋</h1>
    <p class="lead">Aspiring Software Engineer & .NET Enthusiast</p>
</div>

<div class="mt-4">
    <h3>Projects</h3>
    <ul>
        <li><strong>ASP.NET Core MVC App</strong> - Built dynamic web applications.</li>
        <li><strong>Git Collaboration Workshop</strong> - Mastered PRs and conflict resolution.</li>
    </ul>
</div>
```

#### 3. Add Navigation Link in `Views/Shared/_Layout.cshtml`:
Inside the `<ul class="navbar-nav flex-grow-1">` list right after Privacy (line 28):
```html
<li class="nav-item">
    <a class="nav-link text-dark" asp-area="" asp-controller="Home" asp-action="JimPortfolio">Jim's Portfolio</a>
</li>
```

---

### Developer 2: Alex's Portfolio (`feature/alex-portfolio`)

#### 1. Add Controller Action in `Controllers/HomeController.cs`:
```csharp
public IActionResult AlexPortfolio()
{
    ViewData["Title"] = "Alex's Portfolio";
    return View();
}
```

#### 2. Create View `Views/Home/AlexPortfolio.cshtml`:
```html
@{
    ViewData["Title"] = "Alex's Portfolio";
}

<div class="jumbotron text-center p-5 bg-light rounded-3">
    <h1>Hello, I'm Alex! 🚀</h1>
    <p class="lead">Full Stack Developer & Cloud Enthusiast</p>
</div>

<div class="mt-4">
    <h3>My Skills</h3>
    <ul>
        <li>C#, .NET Core, ASP.NET MVC</li>
        <li>Docker, Azure, and CI/CD Pipelines</li>
    </ul>
</div>
```

#### 3. Add Navigation Link in `Views/Shared/_Layout.cshtml`:
Developer 2 also edits right after line 28 (the exact same location!):
```html
<li class="nav-item">
    <a class="nav-link text-dark" asp-area="" asp-controller="Home" asp-action="AlexPortfolio">Alex's Portfolio</a>
</li>
```

---

## 4. Triggering & Resolving Merge Conflicts in GitHub PR

### How the Conflict Happens
1. **Developer 1 (Jim)** opens a PR from `feature/jim-portfolio` to `main`.
2. Jim's PR has no conflicts. It gets approved and **merged into `main`**.
3. Now, **`main` has updated line 29 of `_Layout.cshtml`** and line 20 of `HomeController.cs`.
4. **Developer 2 (Alex)** opens a PR from `feature/alex-portfolio` to `main`.
5. 🚨 **GitHub blocks the merge!** GitHub displays:
   > *"This branch has conflicts that must be resolved."*

---

### Step-by-Step: Resolving the Conflict in GitHub's PR Web Interface

No terminal commands needed for this method—you can fix it directly inside GitHub!

```
[ Step 1: Open PR on GitHub ]
             │
             ▼
[ Step 2: Click "Resolve conflicts" button ]
             │
             ▼
[ Step 3: Inspect Conflict Blocks in Editor ]
             │
   <<<<<<< feature/alex-portfolio
   <li class="nav-item">...Alex's Portfolio...</li>
   =======
   <li class="nav-item">...Jim's Portfolio...</li>
   >>>>>>> main
             │
             ▼
[ Step 4: Edit code to keep BOTH items & remove markers ]
             │
   <li class="nav-item">...Jim's Portfolio...</li>
   <li class="nav-item">...Alex's Portfolio...</li>
             │
             ▼
[ Step 5: Click "Mark as resolved" (Top Right) ]
             │
             ▼
[ Step 6: Click "Commit merge" ]
             │
             ▼
[ Step 7: PR is clean! Click "Merge pull request" 🎉 ]
```

#### Detailed Breakdown of Step 4 (Code Resolution):

#### Conflict in `Views/Shared/_Layout.cshtml`:
**Before (Raw Conflict Markers):**
```html
<<<<<<< feature/alex-portfolio
                        <li class="nav-item">
                            <a class="nav-link text-dark" asp-area="" asp-controller="Home" asp-action="AlexPortfolio">Alex's Portfolio</a>
                        </li>
=======
                        <li class="nav-item">
                            <a class="nav-link text-dark" asp-area="" asp-controller="Home" asp-action="JimPortfolio">Jim's Portfolio</a>
                        </li>
>>>>>>> main
```

**After (Resolved - Keep Both Portfolios):**
```html
                        <li class="nav-item">
                            <a class="nav-link text-dark" asp-area="" asp-controller="Home" asp-action="JimPortfolio">Jim's Portfolio</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link text-dark" asp-area="" asp-controller="Home" asp-action="AlexPortfolio">Alex's Portfolio</a>
                        </li>
```

#### Conflict in `Controllers/HomeController.cs`:
Repeat the same step for `HomeController.cs` to ensure both `JimPortfolio()` and `AlexPortfolio()` action methods exist together.

Click **Mark as resolved** $\rightarrow$ **Commit merge** $\rightarrow$ **Merge pull request**!

---

## 5. Understanding the MVC Architecture Behind the Portfolio

How does ASP.NET Core handle the new portfolio tabs?

```
Browser Request: GET /Home/JimPortfolio
                     │
                     ▼
          Routing Middleware (Program.cs)
Matches: Controller = "Home", Action = "JimPortfolio"
                     │
                     ▼
          Controllers/HomeController.cs
Executes: public IActionResult JimPortfolio() => View();
                     │
                     ▼
             Razor View Engine
Finds: Views/Home/JimPortfolio.cshtml
Wraps inside: Views/Shared/_Layout.cshtml (at @RenderBody())
                     │
                     ▼
        Browser receives complete HTML page
```

### Key Takeaways
1. **Routing Convention:** The URL `/Home/JimPortfolio` automatically routes to `HomeController` and calls the `JimPortfolio()` action method.
2. **View Association:** Calling `return View()` without arguments tells Razor to find the view file named after the action inside `Views/Home/`.
3. **Shared Layout:** Every view rendered automatically inherits the common navbar and footer from `_Layout.cshtml` via `@RenderBody()`.
4. **Git Harmony:** Merge conflicts are normal in team development; resolving them in GitHub PR ensures code from both teammates integrates smoothly.