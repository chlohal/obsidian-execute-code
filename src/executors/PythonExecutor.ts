import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import ExecuteCodePlugin from "src/main";
import { Outputter } from "src/Outputter";
import { ExecutorSettings } from "src/Settings";
import AsyncExecutor from "./AsyncExecutor";

export default class PythonExecutor extends AsyncExecutor {

    process: ChildProcessWithoutNullStreams

    constructor(settings: ExecutorSettings) {
        super();

        const args = settings.pythonArgs ? settings.pythonArgs.split(" ") : [];

        args.unshift("-i");

        this.process = spawn(settings.pythonPath, args);

        //send a newline so that the intro message won't be buffered
        this.dismissIntroMessage();
    }

    async dismissIntroMessage() {
        this.addJobToQueue((resolve, reject) => {
            this.process.stdin.write("\n");

            this.process.stderr.once("data", (data) => {
                resolve();
            });
        });
    }

    async run(code: string, outputter: Outputter, cmd: string, cmdArgs: string, ext: string) {
        return this.addJobToQueue((resolve, reject) => {
            this.process.stdin.write(code + "\n");
            
            outputter.clear();

            let writeToStdout = (data: any) => {
                console.log(data.toString());
                outputter.write(data.toString());
            };

            let writeToStderr = (data: any) => {
                const stringData = data.toString();

                console.log(stringData);

                const removedPrompts = stringData.replace(/(^((\.\.\.|>>>) )+)|(((\.\.\.|>>>) )+$)/g, "")

                outputter.writeErr(removedPrompts);

                if (stringData.endsWith(">>> ")) {
                    //wait a little bit for the stdout to flush
                    setTimeout(() => {
                        this.process.stdout.removeListener("data", writeToStdout);
                        this.process.stderr.removeListener("data", writeToStderr);
                        resolve();
                        console.log("done!");
                    }, 100);
                }
            }

            this.process.stdout.on("data", writeToStdout);
            this.process.stderr.on("data", writeToStderr);
        });
    }

}