// Pipeline MedLink : build, tests, SonarQube, OWASP ZAP, Docker Hub
pipeline {
  agent { node { label 'built-in'; customWorkspace '/home/souhajo/jenkins_workspace/medlink' } }
  options { timeout(time: 40, unit: 'MINUTES'); disableConcurrentBuilds() }
  environment { COMPOSE_PROJECT_NAME = 'medlink-ci' }
  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Build, audit et tests (US-58, US-59)') {
      steps {
        dir('backend')  { sh 'npm ci && (npm audit --audit-level=high || true)' }
        dir('frontend') { sh 'npm ci && npm run build && npx vitest run' }
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
          docker volume rm -f zapwrk || true
          docker run --name zap -u root --network medlink-ci_default -v zapwrk:/zap/wrk \
            ghcr.io/zaproxy/zaproxy:stable \
            zap-baseline.py -t http://frontend:80 -r zap-frontend.html -I || true
          docker cp zap:/zap/wrk/zap-frontend.html . || true
          docker rm -f zap
        '''
      }
    }

    stage('Publier sur Docker Hub') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials',
                                          usernameVariable: 'DH_USER',
                                          passwordVariable: 'DH_PASS')]) {
          sh '''
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            for svc in backend frontend; do
              docker build -t $DH_USER/medlink-$svc:${BUILD_NUMBER} \
                           -t $DH_USER/medlink-$svc:latest ./$svc
              docker push --all-tags $DH_USER/medlink-$svc
            done
          '''
        }
      }
    }
  }
  post {
    always {
      publishHTML(target: [reportDir: '.', reportFiles: 'zap-frontend.html',
                           reportName: 'Rapport ZAP', allowMissing: true, keepAll: true])
      archiveArtifacts artifacts: 'zap-frontend.html', allowEmptyArchive: true
      sh 'docker compose down -v || true'
      sh 'docker logout || true'
    }
  }
}
