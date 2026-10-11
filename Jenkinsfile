// Declarative pipeline for the self-healing Playwright framework.
//
// Two ways to run (parameter USE_DOCKER):
//   false -> native on a Windows agent: needs Python 3.11+, Node 20+ and npm on the agent's PATH.
//   true  -> in containers via docker compose: needs Docker (Docker Desktop on Windows, or Docker on Linux).
//
// One-time Jenkins setup:
//   * Plugins: Pipeline, Credentials Binding, Timestamper. Optional: HTML Publisher (Playwright report link).
//   * Credential: Manage Jenkins > Credentials > Global > Add > "Secret text",
//     ID = gemini-api-key, Secret = your Gemini API key. (Not needed if you untick USE_GEMINI.)

// ---- helpers ----------------------------------------------------------------
def npmScriptFor(String suite) {
    def scripts = [
        smoke  : 'test:smoke',
        offline: 'test:offline',
        e2e    : 'test:e2e',
        healing: 'test:healing',
        drift  : 'test:drift',
        saucedemo: 'test:saucedemo',
        all    : 'test'
    ]
    return scripts[suite]
}

// Runs the body with Gemini credentials, or with the offline (no key) configuration.
def withGemini(Closure body) {
    if (params.USE_GEMINI) {
        withCredentials([string(credentialsId: 'gemini-api-key', variable: 'GEMINI_API_KEY')]) {
            withEnv(['LLM_PROVIDER=gemini', 'EMBEDDINGS_PROVIDER=gemini']) {
                body()
            }
        }
    } else {
        withEnv(['LLM_PROVIDER=none', 'EMBEDDINGS_PROVIDER=hashing']) {
            body()
        }
    }
}

// One command, any OS, failing the stage on a non-zero exit code.
def runCmd(String cmd) {
    if (isUnix()) {
        sh cmd
    } else {
        powershell("${cmd}\nif (\$LASTEXITCODE -ne 0) { exit \$LASTEXITCODE }")
    }
}

// ---- pipeline ---------------------------------------------------------------
pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 60, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    }

    // Uncomment for a nightly run (note: it hits the shared public demo store).
    // triggers { cron('H 2 * * 1-5') }

    parameters {
        choice(name: 'SUITE', choices: ['smoke', 'offline', 'e2e', 'healing', 'drift','saucedemo', 'all'],
               description: 'smoke/e2e/healing run against BASE_URL. offline heals a local mock page (no internet). drift = e2e with stale locators. all = every spec.')
        booleanParam(name: 'USE_DOCKER', defaultValue: false,
                     description: 'Run the healer service and tests in Docker containers instead of natively.')
        booleanParam(name: 'USE_GEMINI', defaultValue: true,
                     description: 'Use Gemini for LLM + embeddings (needs the gemini-api-key credential). Untick to run heuristics-only without a key.')
        string(name: 'BASE_URL', defaultValue: 'https://demo.opencart.com', description: 'Application under test')
        string(name: 'MAX_HEALS', defaultValue: '-1', description: 'Fail the build if more locators than this were healed (-1 = no limit)')
    }

    environment {
        HEALER_PORT = '8000'
        HEALER_URL  = 'http://127.0.0.1:8000'
        CI          = 'true'
        PYTHONUTF8  = '1'
    }

    stages {
        stage('Prepare') {
            steps {
                script {
                    env.NPM_SCRIPT = npmScriptFor(params.SUITE)
                    currentBuild.displayName = "#${env.BUILD_NUMBER} ${params.SUITE}" + (params.USE_DOCKER ? ' (docker)' : '')
                }
                echo "Suite=${params.SUITE} -> npm run ${env.NPM_SCRIPT} | docker=${params.USE_DOCKER} | gemini=${params.USE_GEMINI} | target=${params.BASE_URL}"
            }
        }

        // ================= NATIVE MODE (Windows agent) =================
        stage('Tool check (native)') {
            when { expression { !params.USE_DOCKER } }
            steps {
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    python --version
                    node --version
                    npm --version
                '''
            }
        }

        stage('Healer service: unit tests (native)') {
            when { expression { !params.USE_DOCKER } }
            steps {
                // Unit tests are fully offline: no Gemini, no network.
                withEnv(['LLM_PROVIDER=none', 'EMBEDDINGS_PROVIDER=hashing']) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'
                        Set-Location healer-service
                        if (-not (Test-Path '.venv\\Scripts\\python.exe')) {
                            python -m venv .venv
                            if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python virtual environment' }
                        }
                        & .\\.venv\\Scripts\\python.exe -m pip install --quiet --upgrade pip
                        & .\\.venv\\Scripts\\python.exe -m pip install --quiet -r requirements-dev.txt
                        if ($LASTEXITCODE -ne 0) { throw 'pip install failed' }
                        & .\\.venv\\Scripts\\python.exe -m pytest
                        exit $LASTEXITCODE
                    '''
                }
            }
        }

        stage('Playwright: install + typecheck (native)') {
            when { expression { !params.USE_DOCKER } }
            steps {
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    Set-Location tests-ts
                    npm ci
                    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
                    npx playwright install chromium
                    if ($LASTEXITCODE -ne 0) { throw 'playwright browser install failed' }
                    npm run typecheck
                    exit $LASTEXITCODE
                '''
            }
        }

        stage('Run tests with healer service (native)') {
            when { expression { !params.USE_DOCKER } }
            steps {
                script {
                    withGemini {
                        powershell '''
                            $ErrorActionPreference = 'Stop'
                            $root   = (Get-Location).Path
                            $svcDir = Join-Path $root 'healer-service'
                            $py     = Join-Path $svcDir '.venv\\Scripts\\python.exe'
                            $outLog = Join-Path $svcDir 'healer.log'
                            $errLog = Join-Path $svcDir 'healer.err.log'
                            $port   = $env:HEALER_PORT
                            $env:KB_DIR = Join-Path $svcDir 'data\\chroma'   # persists between builds, so heals are remembered

                            $proc = Start-Process -FilePath $py `
                                -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--port', $port) `
                                -WorkingDirectory $svcDir `
                                -RedirectStandardOutput $outLog -RedirectStandardError $errLog `
                                -PassThru -WindowStyle Hidden
                            $code = 1
                            try {
                                $health = $null
                                for ($i = 0; $i -lt 45; $i++) {
                                    if ($proc.HasExited) { break }
                                    try {
                                        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 3
                                        if ($health.status -eq 'ok') { break }
                                    } catch { }
                                    $health = $null
                                    Start-Sleep -Seconds 2
                                }
                                if (-not $health) {
                                    Write-Host '--- healer log ---'
                                    Get-Content $outLog, $errLog -ErrorAction SilentlyContinue
                                    throw 'Healer service did not become healthy'
                                }
                                Write-Host ('Healer service is up: ' + ($health | ConvertTo-Json -Compress))

                                Push-Location (Join-Path $root 'tests-ts')
                                npm run $env:NPM_SCRIPT
                                $code = $LASTEXITCODE
                                Pop-Location
                            }
                            finally {
                                if ($proc -and -not $proc.HasExited) { & taskkill /PID $proc.Id /T /F | Out-Null }
                            }
                            exit $code
                        '''
                    }
                }
            }
        }

        // ================= DOCKER MODE =================
        stage('Docker: tool check') {
            when { expression { params.USE_DOCKER } }
            steps {
                script { runCmd('docker --version\ndocker compose version') }
            }
        }

        stage('Docker: build images') {
            when { expression { params.USE_DOCKER } }
            steps {
                script {
                    runCmd('docker compose --profile tests build')
                    // Keep a build-numbered tag next to :latest so any build can be reproduced.
                    runCmd("docker tag selfheal/healer-service:latest selfheal/healer-service:${env.BUILD_NUMBER}")
                    runCmd("docker tag selfheal/playwright-tests:latest selfheal/playwright-tests:${env.BUILD_NUMBER}")
                }
            }
        }

        stage('Docker: run tests') {
            when { expression { params.USE_DOCKER } }
            steps {
                script {
                    withGemini {
                        // compose starts the healer, waits until it is healthy, then runs the tests container
                        withEnv(["BASE_URL=${params.BASE_URL}", "MAX_HEALS=${params.MAX_HEALS}"]) {
                            runCmd("docker compose --profile tests run --rm tests npm run ${env.NPM_SCRIPT}")
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                if (params.USE_DOCKER) {
                    try {
                        runCmd('docker compose --profile tests logs healer > healer-service-container.log')
                    } catch (err) {
                        echo "Could not collect healer container logs: ${err}"
                    }
                    try {
                        // No -v: the named volume keeps the knowledge base, so the healer remembers fixes across builds.
                        runCmd('docker compose --profile tests down --remove-orphans')
                    } catch (err) {
                        echo "docker compose down failed: ${err}"
                    }
                }
                junit allowEmptyResults: true, testResults: 'tests-ts/reports/junit/*.xml'
                archiveArtifacts artifacts: 'tests-ts/reports/**, tests-ts/test-results/**, healer-service/healer*.log, healer-service-container.log',
                                 allowEmptyArchive: true
                try {
                    publishHTML(target: [reportName: 'Playwright Report', reportDir: 'tests-ts/reports/html',
                                         reportFiles: 'index.html', keepAll: true, alwaysLinkToLastBuild: true, allowMissing: true])
                } catch (err) {
                    echo 'HTML Publisher plugin is not installed; download the report from the build artifacts (tests-ts/reports/html).'
                }
            }
        }
        failure {
            echo 'Build failed. Check tests-ts/reports/healing/healing-report.md and the Playwright report in the artifacts.'
        }
    }
}
