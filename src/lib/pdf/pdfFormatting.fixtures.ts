export const paginationStressFixture = `# Joe Doe
joe@example.com · +48 123 456 789

## Experience
### Orange
**Test Automation Engineer**
Jul 2017 – Feb 2020
- Built CI/CD pipelines using Jenkins and GitHub Actions to automate builds and regression test suites.
- Collaborated with backend teams to enhance API contract testing in microservice-based architectures.
<!-- pagebreak -->
- Designed end-to-end test strategies and automation frameworks using Python.

## Education
University of Technology
**Automation and Robotics Engineer**
Automation and Robotics Engineer
Sep 2013 – Jun 2017

## Skills
**Python & Backend Development:** Python (Advanced), FastAPI (Advanced), REST APIs (Intermediate)
- Docker (Intermediate), GitHub Actions (Basic), Jenkins (Basic)
`

export const dividerAndBulletFixture = `## Summary
Backend Engineer
---
---
## Experience
• Automated test suites for API and database validation.
`

/** Minimal CV with mdcraft `<-new_page->` token (also accepts legacy `<!-- pagebreak -->`). */
export const mdcraftPageBreakFixture = `# Jane Doe
jane@example.com

## Experience
First job line.

<-new_page->

## Education
University
`

/** No blank lines around token — regression for isolated div + marked block structure. */
export const mdcraftTightBreakBetweenHeadings = '## Alpha\n<-new_page->\n## Beta'

/** Junk instructional line often pasted into CV body (should not appear in print HTML). */
export const mdcraftWithInstructionalLineFixture = `## Summary
Hello

(Optional: Insert page break if manual PDF formatting needed)

## Experience
Work
`
