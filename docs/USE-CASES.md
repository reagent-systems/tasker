# Use cases

Each case has the same shape.
You record the work one time. The rolodex holds the card. The play key repeats the work.

## Accounts payable

**Record.** Open the Excel export. Read each row. Open QuickBooks. Enter the row as a receipt.
**Play.** Run the same import each Monday.
**Undo.** The undo key marks the run and starts your revert command.

## Invoice export

**Record.** Filter the open invoices. Export the list. Write the file to a dated folder.
**Play.** Repeat the export at the end of each month.

## Lead handoff

**Record.** Open a new form entry. Create the contact in the customer relationship system.
Set the owner. Send the notification.
**Play.** Run the handoff for each new lead.

## Ticket triage

**Record.** Read the new tickets. Set the product area. Set the priority. Assign the queue.
**Play.** Clear the queue each morning.

## Expense reports

**Record.** Open a receipt image. Read the amount, the date and the merchant. Fill the expense form.
**Play.** Process a folder of receipts in one run.

## Onboarding

**Record.** Create the accounts of a new colleague in the four systems of the team.
**Play.** Repeat the steps for the next colleague.

## Data migration

**Record.** Move ten records from the old tool to the new tool.
**Play.** Run the migration for each batch. Watch the preview to confirm the pattern.

## Report assembly

**Record.** Collect the numbers from three dashboards. Paste the numbers into the report document.
**Play.** Rebuild the report each week.

## Quality checks

**Record.** Compare a shipment list against the order system. Mark each difference.
**Play.** Check each new shipment file.

## Demonstration

**Record.** Walk through the product one time. Speak each step.
**Play.** Replay the walkthrough before a customer call.

## Team library

Point `skillRoots` at a shared folder.
Each colleague sees the same cards.
The preview file shows the result before a run starts.

## Selection guide

| Question                                        | Answer                                            |
| ----------------------------------------------- | ------------------------------------------------- |
| The task repeats and the steps do not change.   | Record a skill.                                   |
| The task needs a decision on each run.          | Do not record a skill.                            |
| The task uses an application with an interface. | Use the `command` adapter or the `cli` adapter.   |
| The task uses screen actions only.              | Use the `desktop` adapter.                        |
| The task changes files that you track with git. | Set an undo command that reverts the last commit. |
