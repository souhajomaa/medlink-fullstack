pipeline {
  agent { node { label 'built-in'; customWorkspace '/opt/jenkins_workspace/medlink' } }
  environment { COMPOSE_PROJECT_NAME = 'medlink-ci' }
  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Build et audit (US-58, US-59)') {
      steps {
        dir('backend')  { sh 'npm ci && (npm audit --audit-level=high || true)' }
        dir('frontend') { sh 'npm ci && npm run build' }
      }
    }

    stage('SonarQube (US-59, US-61)') {
      steps {
        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
          sh 'npx --yes @sonar/scan -Dsonar.host.url=http://sonarqube:9000 -Dsonar.token=$SONAR_TOKEN'
        }
      }
    }

    stage('Démarrer la stack') {
      steps {
        withCredentials([file(credentialsId: 'medlink-env', variable: 'ENVFILE')]) {
          sh 'cp $ENVFILE .env'
        }
        sh 'docker compose up -d --build'
        sh 'sleep 90'
        sh 'docker compose exec -T backend npm run seed'
      }
    }

    stage('Scan OWASP ZAP (US-60)') {
      steps {
        sh '''
          docker rm -f zap || true
          docker run --name zap --network medlink-ci_default -v zapwrk:/zap/wrk \
            ghcr.io/zaproxy/zaproxy:stable \
            zap-baseline.py -t http://frontend:80 -r zap-frontend.html -I || true
          docker cp zap:/zap/wrk/zap-frontend.html . || true
          docker rm -f zap
        '''
      }
    }
  }
  post {
    always {
      publishHTML(target: [reportDir: '.', reportFiles: 'zap-frontend.html',
                           reportName: 'Rapport ZAP', allowMissing: true, keepAll: true])
      sh 'docker compose down -v || true'
    }
  }
}