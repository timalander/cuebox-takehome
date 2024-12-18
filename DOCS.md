# Data Quality Notes

- The "Gender" field is incorrectly being used to store marital status
- Primary email addresses are not guaranteed to be present in records
- Patron records can contain multiple email addresses (more than two)
  - Current handling: Select primary email if present, plus first additional email
- Date formats are inconsistent across the dataset
- Refunded donations are being treated as negative donations
  - Note: This is an assumption - they may actually represent voided donations

# Testing Notes

The processor test suite (`processor.test.ts`) verifies:

- Constituent data processing
  - Basic person record transformation
  - Company record handling
  - Tag mapping and counting
  - Background information formatting
- Email handling
  - Multiple email addresses per constituent
  - Invalid email filtering
  - Primary/secondary email selection
- Donation calculations
  - Lifetime donation summation
  - Refund handling
  - Most recent donation tracking
  - Date standardization

Test data is generated using CSV strings converted to Buffers to simulate file uploads.
