# Claude.md - Project Context for the PTOFlow app

## Creator Overview
I am not a developer, but am a SaaS founder and three-time Chief Product Officer. I have much knowledge of building software from a Product perspective, but do not write code myself. I am also not a designer and am used to have a design team to do that work.

This means that:

- I will be able to describe the goal of the PTO product, its value to users, and the specific jobs-to-be-done at a high-level.
- I will **NOT** be able to recommend specific technologies, programing languages, or development infrastructure that would be ideal for this product.
- I will **NOT** be able to review code. 
- With that said, I am very comfortable having technical conversations that refer to code, functions, and functionality in English. 
- I will **NOT** be able to provide high quality UI designs. 
- I will be able to provide rough designs for reference when needed. 
- I will be able to have high-level design conversations and am **VERY CONCERNED** with great UX.
- I will be able to provide some QA, but must insist that the code generated from Claude is tested and QA'ed before it is assigned to me for QA checks. 

## Project Overview
PTOFlow is a simple, point-solution of a SaaS product built to help business teams better build, manage, track, visualize, and collaborate on the time off requests and schedules for their teams and employees. 

Currently companies have a disconnected process for managing the two main pieces of effectively managing PTO schedules. The two pieces are (1) managing PTO approvals; and (2) creating visibility into PTO calendars. Companies currently use existing PR/HR management tools (like Workday, Namely, Rippling, etc) for PTO request workflows and tracking (even though these workflows are very clunky), but are left trying to create their own PTO calendars to give employees visibility into their teammates' PTO. These are often shared Google calendars (for Google Workspace customers) that employees must manage in order to get their PTO posted to a wider team. 

I want PTO Flow to be a one-stop shop for this simple, but painful problem in any organization. 

## Context on PTO and other terms

* PTO stands for "Paid time off". It is a catch-all term for time off. This application could be used by companies that have "non-paid" time off, but for the sake of this application development, PTO will refer to any time of time off.
* The number of days off still available to an employee will be referred to as his **"Bank"**. For example, a company may allow 20 days of Vacation time annually. This means that every employee will start with a "Bank" of 20 days in the Vacation category. If an employee is approved for 3 days of PTO in the Vacation category, he will have 17 days remaining in his Bank for the Vacation category. A Bank can also be "unlimited" - meaning it does not have a Bank that needs tracking. All Banks reset on Jan 1st of every year and any remaining days in any Bank on Dec. 31st do NOT rollover to the next year. When new employees are onboarded in the middle of the year (ie - anytime after January 1st), Bank values should be prorated based on how much of the year is left after the start date. The calculation for this proration is based on the % of work days remaining in the year (if there are 260 total Working Days in a year and on a new employee start date, there are 130 Working Days in the year, then that employee will be assigned 50% of the annual Bank). 
* Unlimited days off means that a company does not set any maximum limits on the number of days that an employee can take off per year. In this case, there may be a MINIMUM limit number of days that they may require (based on their own policies or local government regulations). 
* Working days are days for which an employee is expected to work. Company holidays are days that employees are NOT expected to work - this includes weekends by default. 


## Core functionality overview

The PTO problem can be broken up into the following core pieces of functionality (or jobs). These will be presented as "needs" from a user in a simple list and described in more detail after:

1. "I need a way for my employees to request time off and for their managers to easily approve (or deny) those requests." 
2. "I need a system that will keep track of the requests made and insure that my employees are not going over (or under) any of our company limits." 
3. "I need a way for my employees to request PTO across various categories of "time off"
4. "I need a system that will create a PTO calendar in Google Workspace so that everyone on each of my teams can see whenever any of their teammates are on PTO." 
5. "I need a way to insure that anyone who is on PTO cannot be invited to meetings via Google Workspace"
6. "I need an interface that will allow me to configure my PTO settings and for and my employees to see and manage their PTO data"
7. "I need a way for my team members to be able to interact with PTOFlow via Slack to manage request workflows as well as request any information about the data managed by PTOFlow."

More detail on each piece of functionality: 

### PTO Approval workflows - *"I need a way for my employees to request time off and for their managers to easily approve (or deny) those requests."

This core functionality enables a classic time off approval process. The basic approval process for a time off request (from a user's perspective) looks like this:

Employee submits a time-off request with (1) the type of time off (more on the categories later), (2) the dates of the request, and (3) an optional description/explanation. >>

Employee receives a confirmation that their request has been submitted >>

Employee's manager receives a notification of the request >>

Manager either approves or rejects the request >>

Employee receives notification of the decision.

The decision is logged in the PTOFlow system either way as the system tracks all requests and results.

If the request is approved, several system functions are triggered. Namely:

* The number of days requested are deducted from the limits of the respective category. For example, if the employee has been approved for 5 Working Days off, and has 7 days remaining in her "Days off bank", then that "bank" will be reduced by five, leaving 2 days.
* The days off will be posted on the team PTO calendar (more later)

If the request is rejected, the manager can be prompted to add a reason for the rejection and this reasoning will sent to the employee with the notification that the request has been rejected. 

Not all requests will require approvals. Some categories of time off (more on categories later) can be set as to not require approval. The workflow for requests not requiring approval should be:

Employee submits a time-off request with (1) the type of time off (more on the categories later), (2) the dates of the request, and (3) an optional description/explanation. >>

Employee receives a confirmation that their request has been automatically approved (because it does not require management approval) >>

Employee's manager receives a notification of the approved request >>

The decision is logged in the PTOFlow system as the system tracks all requests and results.
 


### Track PTO approvals - *"I need a system that will keep track of the requests made and insure that my employees are not going over (or under) any of our company limits."*

For each category of time off (more on this later), a maximum and minimum number of time off days can be set for each employee. This will be referred to as the "Bank". For example, a company may allow 20 days of Vacation time annually. This means that every employee will start with a "Bank" of 20 days in the Vacation category. 

Some other parameters for this functionality:

* The Banks for each category can be set and configured by an Admin user of PTOFlow. These will be set as "default" values for each category.
* The Admin can choose to choose no limit for a Category (by selecting an "Unlimited" option for a category)
* Annual Bank defaults should be prorated for employees based on when they are brought into the system. For example, if an employee starts on June 1st, then they should start with a Bank that is 50% of the annual default. This should be a configuration option that the Admin could choose to turn off (thus giving any new employee added to the system the full value of the default). Banks reset on January 1 of every year. 
* If a category is set to "Unlimited", Admin should have the option to set a minimum amount of days off that the company requires. 
* Every time an employee requests time off, the system must check to see if the employee has enough days left in the Bank to cover the length of the request. If there is not enough days in the Bank, the employee should get a message letting her know that the request would exceed the days allowed. She should be given the option to (1) cancel the request or (2) revise the request.

#### Working Days vs Company Holidays

The PTOFlow system must have an understanding of "Working Days" and "Company Holidays". Only Working Days represent working days. Company Holidays, which should include weekends, are non-working days. The system must be able to calculate the number of Working Days in a request - even if that request includes Company Holidays. For example, if an employee submits a request for a Thursday - Wednesday the following week, the system must know to count only the Thursday, Friday, Monday, Tuesday, and Wednesday (5 days). It should not count the Saturday and Sunday. If that Monday is a Company Holiday (like MLK Day, for example), it should only count 4 days for the request. 

Admin users should be able to configure Company Holidays in the PTOFlow interface. This should default to standard US Holidays as a starting point.   

Admin users should be able to override the Bank of any specific employee when editing an employee profile. 


### Manage PTO categories - *"I need a way for my employees to request PTO across various categories of "time off"*

Categories have been mentioned several times. This functionality will support companies that need or want to track different "types" of time off requests. For example, some companies offer limited vacation time (say, 20 days), but unlimited sick time. 

A new PTOFlow account should start with some default categories, and an Admin should have the ability to create, edit, and delete categories. 

The default Categories and the default Banks. Each category should also be visually represented with an emoji for easy recognition. Emojis included in the below list:

1. 🏝️ Vacation - 20 days
2. 🤒 Sick time - Unlimited
3. ✈️ Traveling - Unlimited
4. 🎓 Professional development - Unlimited
5. 👶🏼 Maternity/Paternity leave - Unlimited
6. 🧠 Mental health - Unlimited
7. ❓ Other - Unlimited

Each request made must be assigned a category. The default category for each request should be Vacation. 

Also, not all categories should require approval. The Admin user should be able to determine if a category of time off should require approval. 


### Shared PTO calendars for Google Workspace - *"I need a system that will create a PTO calendar in Google Workspace so that everyone on each of my teams can see whenever any of their teammates are on PTO."*

This is the most important feature for PTOFlow, but also the trickiest. One of the biggest problems in this space is giving teams easy visibility into their team's availability. How can you quickly see who is on PTO today? This week? In three weeks when we are planning our launch or mapping out the execution of our roadmap?

This information has to live in the calendar application that the company uses to manage employee calendars. We will start by creating this functionality in Google Calendar in a Google Workspace account. We may expand to support Microsoft Outlook calendar in the future, but for now we will focus on Google Workspace/Google Calendar. 

I am not exactly how this should work in the Google paradigm, but here is my best thoughts at this time. 

* These should be shared calendars that employees should be able to easily add to their Google Calendar view (they should be part of the My Calendars section in Google Calendar)
* PTOFlow should have the ability to create multiple shared calendars for any Account so that users can create these shared calendars for each team (and an "All Company" calendar as well). Employees on those teams should have access to view those calendars in their Google Calendar instance. 
* Whenever a PTO request is made, those days should be posted to that calendars that that employee is a part of (the All Company calendar as well as his team calendar if it exists). 
* When an employee is added to that calendar it should appear as his first initial and last name with the emoji of the time of category that coincides with the request.  


### Manage schedule of employees on PTO - *"I need a way to insure that anyone who is on PTO cannot be invited to meetings via Google Workspace"*

When an employee has approved time off, PTOFlow will create an Out of Office event on the employee's Google Calendar. This will cause Google to automatically decline any meeting invitations during that period.


### PTO Flow interface - *"I need an interface that will allow me to configure my PTO settings and for and my employees to see and manage their PTO data"*

While the vision for this product is for a lot of the functionality to be accessed and enabled via other external touchpoint (for example Slack and email), but PTOFlow will also have a full User Interface that will give users full access to the product's full functionality. I will provide more detail about the elements of this interface in a later section, but at a high-level, the interface will provide: 

1. Access for three-levels of users:
* Admins: These users have full access to the product - especially to configure the settings that will define the rules of their instance.
* Managers: Managers will have the ability to manage requests from their employees as well as team calendars. They will also have the ability to manage their OWN PTO requests, just like Team Members (see next bullet)
* Team Members: These are non-manager employees who will use the interface to view and manage their own PTO request. 
2. A dashboard where a user can see their own upcoming PTO, their active requests, and the upcoming PTO for their teammates. Managers should also see any open requests that require their attention.
3. A personal profile page where a user can see their own PTO history, pending requests, a status of their remaining bank - and make new PTO requests. 
4. A team page where a user can see the upcoming PTO for their teammates - their department - of the company as a whole. 
5. A settings page where users can manage the settings for which they have access. This will include:
* A place to CRUD (create, edit, delete) users on the account. New users can be added from this page. See "Adding new employees" section for more detail on this process.  
* A place to CRUD PTO categories. This includes assigning the Bank for each category. 
* A place to define the company Holiday calendar. 
* A place to manage integrations.


### Slack bot - *"I need a way for my team members to be able to interact with PTOFlow via Slack to manage request workflows as well as request any information about the data managed by PTOFlow."*

A Slack integration - a PTOFlow Slackbot - is an essential part of the PTOFlow value proposition as it will allow PTO request management to be handled via Slack so that users (both employees and managers) will not have to log in to the PTOFlow interface to manage their PTO request workflows. Users will be able to make PTO requests from Slack, Managers will be able to approve/deny requests from Slack, and all notifications can be delivered via Slack. There will not be an LLM interpretation engine for the MVP of this functionality so users will not be able to interact with this bot in natural language. This bot will use Slack commands and forms to manage these Slack interactions. 

 
### Team structure / org hierarchy 

In order to manage PTO request flows properly, PTOFlow must allow users to create a reporting structure. Each employee will not be required to have a "manager", but in most companies every employee should have a manager. 

PTOFlow will also allow users to create Teams (which is analogous to departments in a company). This Teams functionality will allow users to create separate calendars that can be viewed in Google Calendar. It will not be helpful for bigger companies to have only one "All Company" calendar for end users to view in Google Calendar - that will simply be too noisy and not offer the information that employees need - which is "who on my team is going to be out [during this time frame that I care about]".

Teams will also allow for an easier path to create a reporting structure. For each team, a manager can be named - in which case, all the employees on that team will be assigned that manager. Managers can be assigned as the manager of multiple teams. Employees should only be a part of one team. And while a Team can be assigned a Manager, an Admin should be able to override the "Team manager" assignment with a different manager assignment if need be. Meaning, the Team manager will provide a default for the employee-manager relationship, but that can be changed later. 


### Adding new employees

Admins can add new employees to PTOFlow during new account onboarding or from the Settings page. New employees can be added manually (Admin typing in Names and Email addresses in an Add Employee form) or in bulk via a CSV upload. Lastly, PTOFLow should be able to import all the employees from a Google Workspace account once given permission. When an employee is added to PTOFlow, that employee will receive an email invite with a link that will lead them to an option to SSO into their Google account. 


## Project technical architectural structure

Again, I am not an engineer, so will not make any specific recommendations or requirements on the technical side, but I will use this section to outline the basic architectural needs of the project. At a high-level (more detail of each need detailed below):

1. Front-end framework for the product's web-based UI. The front-end code should be separated from the backend code. At a later date, we would likely want a iOS app for the product, so it makes sense to use a framework like React native to make that potential expansion easier.
2. Database that can manage user accounts and their relationships as well as roles and access levels. Users should only be able to signin or signup for PTOFlow using a Google SSO. 
3. PTO request database to manage all PTO requests, statuses, categories, and Banks. This database must be able to interact with the users - team members, managers, and admins.
4. A multi-tenant infrastructure for PTOFlow accounts. Brand new accounts will ultimately be created via a self-serve signup from the website (but for the MVP, we will create new accounts manually, the initial account and admin user will be seeded directly in the database). The first signup will be assigned an Admin role. A database must manage accounts on PTOFLow including configuration settings, paid status, billing, etc. As this will operate like a typical SaaS multi-tenant application, Customer A should NEVER have access to Customer B's data. 
5. An API infrastructure that exposes PTOFlow functionality such as PTO requests as well as a way to access the data re: PTO history for each employee.
6. A Google Workspace integration service that manages the integration into Google Workspace to manage PTO calendars in Google Calendar. PTOFlow will integrate with Google Workspace via the Google Calendar API using OAuth 2.0. We will support domain-wide delegation for enterprise customers whose admins grant it via their Google Admin Console. We are NOT building a Google Workspace Marketplace app at this time. When PTO is approved, PTOFlow should create an Out of Office event on the employee's Google Calendar for the approved dates.
7. A Slack integration service that manages the Slack bot integration. 
8. I would like to deploy this app easily without managing servers or databases. 
9. I have a Mac so development needs to be Mac-based.


## Build order

Here is a build order for this MVP:

1. Auth
2. Core data model
3. PTO request/approval flow. A minimal functional UI should be scaffolded alongside step 3 for testing purposes. The full production UI will be built in step 
4. UI
5. Slack integration for PTO request approval flow
6. Google Calendar


## Known gaps / future flows to design and build

1. **Google Calendar admin user deletion** — PTOFlow's shared PTO calendars (All Company + team calendars) are owned by the Google account of whichever Admin created them. If that admin is ever deleted from Google Workspace, the OAuth tokens become invalid, calendar writes silently fail, and the calendars themselves may be lost depending on how Google handles account offboarding. A flow is needed to: (a) detect this failure state, (b) allow another admin to reassign calendar ownership to their own account, and (c) handle re-creation of calendars if they were deleted.


## DO NOT BUILD

Here are some things we will build at a later date:

1. Interpretation engine that translates natural language PTO requests into structured requests that the system can handle. This means that we will not be building an email "bot" that allows employees to make PTO request via email in natural language which kick off an approval flow that a manager can approve/reject via email, in natural language, as well. Nor will we build a natural language workflow in Slack. 
2. We will not be building authentication via Username and Password or other methods of Auth. The MVP will be designed exclusively for companies using Google Workspace. Google SSO is the only supported authentication method.sel
3. We will not be building a new account onboarding flow to support self-serve signup and onboarding yet. Soon.  
4. We will not be building billing infrastructure for the MVP, so will not be integrating with Stripe for the MVP. 
5. We will not be building a Google Workspace app
6. We will not be building a mobile app (iOS or Android) 
7. We will not be building any integrations with other HR platforms (Rippling, Workday, Namely, etc) at this time. 