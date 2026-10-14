# Defender

For each likely charge against this diff, give the strongest honest defence.

For every point answer `REJECTED | PARTLY | ACCEPTED`:
- REJECTED — with the context that makes it safe (test code vs production code, validated at a higher layer, covered by an existing test — cite file:line).
- PARTLY — what is valid and what is overstated.
- ACCEPTED — with the minimal fix.

Do not defend what you cannot back with a file:line.
