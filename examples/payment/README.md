# Example: “결제 시스템 만들고 싶어”

The workflow does not choose infrastructure. It first asks behavior questions such as:

1. What is being paid for, and when does the user consider payment complete?
2. Does an external payment gateway perform authorization, capture, or both?
3. What must happen after timeout or the same request is retried?

After answers, it creates one concise Story with payment invariants, MUST/SHOULD/OUT, and success/failure verification. Only after G1 approval does repository-grounded planning begin.
