* development speed — every feature takes longer than the last, especially `/implement-feature`
* split the audio-render tests out of the default test run — the generator is 83% of `npm test`'s wall clock and most features never touch it
* run the generator tier only when an epic touches `scripts/`
* drop the 30 s testTimeout patch once the two projects stop competing for cores
* break up the GroovePuzzle hub file — touched in 13 of the last 14 feature commits, and what forces the implement waves to serialize
* split its 3111-line test file along the describe blocks it already has, so tracks sharing the component still own disjoint test files
* split the 488-line component itself too
* create specialized agents so less documentation has to be passed to each worker
