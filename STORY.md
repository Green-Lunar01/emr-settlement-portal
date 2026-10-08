EMR System – End-to-End User Story

This document describes the complete end-to-end workflow of the EMR system, covering the Cashier/Operations, Facility Manager, and Finance/Auditor roles.
1. Cashier / Operations Workflow
User Story:
As a Cashier/Operations user, I want to record the day's financial transactions in the EMR system so that my facility's daily transaction activity can be compared against the corresponding TAP records.

The Cashier accesses the Daily EMR section and enters the required daily transaction information. The Cashier is responsible for data entry but does not have authority to independently confirm the accuracy of the submitted records.

2. EMR Submission
Once the Cashier has completed the day's entry, they submit the record. The system then automatically compares the EMR figures against the corresponding TAP transaction data.

The comparison includes relevant values such as transaction count and transaction amount.

3. Automatic System Validation
If the EMR and TAP records match, the system displays “Good”.

If there is a discrepancy, the system displays “Check Record” and flags the record for review.

4. Facility Manager Review
User Story:
As a Facility Manager, I want to review submitted EMR records and provide a supervisory assessment so that I can confirm whether the Cashier's submitted figures are acceptable before Finance performs the final verification.

The Manager reviews the EMR figures, TAP figures, comparison results, and any detected mismatch. The Manager can mark the record as Confirmed or Not Confirmed and can provide a review/supervision comment using the manager review text box.

5. Manager Confirmation and Record Locking
Once the Facility Manager confirms the record, the Cashier can no longer modify that submission. This creates a clear separation between data entry and supervisory approval.

Workflow:
Cashier enters → Manager reviews → Manager confirms → Cashier editing becomes locked.

6. Finance / Auditor Review
User Story:
As a Finance/Auditor user, I want to review the EMR and TAP comparison together with the Facility Manager's decision so that I can perform the final financial verification.

Finance can review the EMR figures, TAP figures, mismatch information, automatic system status, Facility Manager's confirmation, and the Facility Manager's comments.

7. Finance Confirmation
If Finance is satisfied with the record, Finance marks it as Confirmed. The record has then completed the review process and is considered fully verified.

Lifecycle:
Pending → Manager Confirmed → Finance Confirmed.

8. Finance Does Not Confirm the Record
If Finance identifies a problem, Finance marks the record as Not Confirmed. The record is returned for correction.

The Cashier can then reopen/correct the EMR and resubmit it.

9. Cashier Correction and Resubmission
The Cashier reviews the issue, corrects the relevant information, and resubmits the EMR. The system runs the EMR-versus-TAP comparison again.

Resubmission resets the review process; previous confirmations do not automatically carry over to the corrected submission.

10. Finance Resolution
User Story:
As a Finance/Auditor user, I want to record a resolution when handling an EMR issue so that there is an auditable explanation of how the issue was resolved.

The Finance Resolution field can document what was wrong, what was corrected, why the record was accepted or rejected, and any relevant financial explanation. This field is restricted to Finance.

11. Complete Successful Journey
Cashier / Operations
↓
Enter EMR
↓
Submit Daily EMR
↓
Automatic EMR vs TAP Comparison
↓
Good / Check Record
↓
Facility Manager Review
↓
Confirmed / Not Confirmed
↓
Finance / Auditor Review
↓
Finance Confirmed
↓
Completed / Verified

12. Rejection and Correction Journey
Cashier / Operations
↓
Enter EMR
↓
Submit
↓
Automatic Comparison
↓
Facility Manager Review
↓
Finance Review
↓
Finance Not Confirmed
↓
Cashier Correction
↓
Resubmission
↓
Automatic Comparison
↓
Manager Review
↓
Finance Review
↓
Final Verification

13. Role Permissions
Cashier / Operations:
• Enter EMR
• Edit own pending EMR
• Submit EMR
• Correct rejected EMR
• Resubmit corrected EMR

Facility Manager:
• View submitted EMR/TAP comparison
• Review EMR
• Confirm or not confirm EMR
• Add supervisory review comments
• View relevant record information

Finance / Auditor:

 

● Review EMR/TAP comparison
● Review Facility Manager decision and comments
● Confirm or not confirm EMR
● Record Finance Resolution
● Perform final verification
● Creates accounts for Cashiers
 

 

14. Core Business Story
The system is designed around separation of duties:

The Cashier records the transaction. The system checks the transaction against TAP. The Facility Manager supervises and confirms the record. Finance performs the final verification and records any financial resolution. If Finance does not confirm the record, it returns to the Cashier for correction and resubmission.

Core lifecycle:
Created → Submitted → Automatically Compared → Manager Reviewed → Finance Reviewed → Confirmed

Exception lifecycle:
Created → Submitted → Compared → Manager Reviewed → Finance Not Confirmed → Corrected → Resubmitted → Reviewed Again