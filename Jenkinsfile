pipeline {
    agent any

    environment {
        DOCKER_HUB_CREDS = credentials('dockerhub-credentials') // Configured in Jenkins as "Username with password"
        IMAGE_NAME       = 'notice-flow-api'
        IMAGE_TAG        = "${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'latest'}"
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
        ansiColor('xterm')
    }

    stages {
        stage('Checkout & Environment Check') {
            steps {
                echo "Running pipeline for commit: ${env.IMAGE_TAG}"
                sh 'docker version'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    echo "Building NoticeFlow API container image..."
                    sh "docker build -t ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:${IMAGE_TAG} -t ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest -f app/Dockerfile app/"
                }
            }
        }

        stage('Test & Health Validation') {
            steps {
                script {
                    echo "Spinning up temporary container for health validation..."
                    sh """
                    docker run -d --name test-api-${IMAGE_TAG} -p 3001:3000 ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:${IMAGE_TAG}
                    sleep 3
                    curl --fail http://localhost:3001/healthz || exit 1
                    docker rm -f test-api-${IMAGE_TAG}
                    """
                }
            }
        }

        stage('Authenticate & Push to Docker Hub') {
            steps {
                script {
                    sh """
                    echo "${DOCKER_HUB_CREDS_PSW}" | docker login -u "${DOCKER_HUB_CREDS_USR}" --password-stdin
                    docker push ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:${IMAGE_TAG}
                    docker push ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                    docker logout
                    """
                }
            }
        }

        stage('Clean Local Artifacts') {
            steps {
                sh """
                docker rmi -f ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:${IMAGE_TAG} || true
                docker rmi -f ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest || true
                """
            }
        }
    }

    post {
        success {
            echo "Successfully pushed images to Docker Hub for user ${DOCKER_HUB_CREDS_USR}!"
        }
        failure {
            echo "Pipeline failed. Cleaning test containers..."
            sh "docker rm -f test-api-${IMAGE_TAG} || true"
        }
    }
}
