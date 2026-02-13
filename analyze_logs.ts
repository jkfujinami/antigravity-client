
import fs from 'fs';
import readline from 'readline';

function parseLog(filename: string, label: string) {
    if (!fs.existsSync(filename)) {
        console.log(`File: ${filename} MISSING`);
        return;
    }
    const fileStream = fs.createReadStream(filename);
    const rl = readline.createInterface(fileStream);

    let currentJsonBuffer = '';
    let readingJson = false;
    let count = 0;

    console.log(`\nScanning ${label} (${filename})...`);

    rl.on('line', (line) => {
        if (line.includes('RAW UPDATE:')) {
            if (currentJsonBuffer.trim().length > 0) {
                processJson(currentJsonBuffer, count++);
            }
            currentJsonBuffer = '';
            readingJson = true;
            return;
        }
        if (readingJson) {
            currentJsonBuffer += line + '\n';
        }
    });

    rl.on('close', () => {
        if (currentJsonBuffer.trim().length > 0) {
            processJson(currentJsonBuffer, count++);
        }
    });

    function processJson(jsonStr: string, idx: number) {
        try {
            const diff = JSON.parse(jsonStr);
            analyzeDiff(diff, idx);
        } catch (e) {
        }
    }
}

function analyzeDiff(diff: any, idx: number) {
    if (!diff.fieldDiffs) return;

    // Check for CascadeState.trajectory (2)
    const trajDiff = diff.fieldDiffs.find((f: any) => f.fieldNumber === 2);
    if (!trajDiff) return;

    // Check for Trajectory.steps (2)
    // FieldDiff has `updateSingular` directly
    const trajVal = trajDiff.updateSingular?.messageValue;
    if (!trajVal || !trajVal.fieldDiffs) return;

    const stepsDiff = trajVal.fieldDiffs.find((f: any) => f.fieldNumber === 2);
    if (!stepsDiff) return;

    const rep = stepsDiff.updateRepeated;
    if (!rep) return;

    // Iterate repeated updates
    if (rep.updateValues && rep.updateIndices) {
        rep.updateValues.forEach((val: any, i: number) => {
            const stepIdx = rep.updateIndices[i];
            const stepDiff = val.messageValue;

            if (!stepDiff || !stepDiff.fieldDiffs) return;

            let statusVal = undefined;
            const statusField = stepDiff.fieldDiffs.find((f: any) => f.fieldNumber === 4);
            if (statusField) {
                statusVal = statusField.updateSingular?.enumValue;
            }

            const runCmdField = stepDiff.fieldDiffs.find((f: any) => f.fieldNumber === 28);

            if (statusVal !== undefined || runCmdField) {
                 const statusMap: any = {1:'PENDING', 2:'RUNNING', 9:'WAITING', 3:'DONE', 8:'GENERATING', 11:'QUEUED'};
                 console.log(`[Update ${idx}] Step ${stepIdx}:`);
                 if (statusVal !== undefined) console.log(`    Status -> ${statusMap[statusVal] || statusVal}`);

                 if (runCmdField) {
                     const runCmdVal = runCmdField.updateSingular?.messageValue;
                     if (runCmdVal && runCmdVal.fieldDiffs) {
                         runCmdVal.fieldDiffs.forEach((f: any) => {
                             if (f.fieldNumber === 23) console.log(`    CommandLine -> ${f.updateSingular?.stringValue}`);
                             if (f.fieldNumber === 16) {
                                  const map: any = {0:'UNSPECIFIED', 1:'USER_ALLOW'};
                                  console.log(`    AutoRunDecision -> ${map[f.updateSingular?.enumValue] || f.updateSingular?.enumValue}`);
                             }
                             if (f.fieldNumber === 15) console.log(`    ShouldAutoRun -> ${f.updateSingular?.boolValue}`);
                         });
                     }
                 }
            }
        });
    }
}

const f1 = 'debug_log_Ask.log';
const f2 = 'debug_log_Always_Run.log';

parseLog(f1, "Ask Failed");
setTimeout(() => parseLog(f2, "Always Run Success"), 3000);
