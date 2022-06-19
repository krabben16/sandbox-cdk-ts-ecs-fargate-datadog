// https://github.com/aws-samples/aws-cdk-examples/blob/1dcf893b1850af518075a24b677539fbbf71a475/typescript/ecs/fargate-service-with-local-image/index.ts
import ec2 = require('aws-cdk-lib/aws-ec2')
import ecs = require('aws-cdk-lib/aws-ecs')
import logs = require('aws-cdk-lib/aws-logs')
import secretsmanager = require('aws-cdk-lib/aws-secretsmanager')
import ecsPatterns = require('aws-cdk-lib/aws-ecs-patterns')
import cdk = require('aws-cdk-lib')
import 'dotenv/config'

const app = new cdk.App()
const stack = new cdk.Stack(app, 'EcsAlbFargateServiceStack')

// https://blue21neo.blogspot.com/2021/04/cdktypescriptvpc.html
const vpc = new ec2.Vpc(stack, 'ecs-alb-fargate-service-stack-vpc', {
  cidr: process.env.CDK_VPC_CIDR,
})

const taskDef = new ecs.FargateTaskDefinition(stack, 'TaskDef', {
  cpu: 256,
  memoryLimitMiB: 512,
})

// Cloudwatch Logs
const webLogGroup = new logs.LogGroup(stack, 'WebLogGroup', {
  logGroupName: '/aws/cdk/ecs-alb-fargate-service-stack/web',
  retention: logs.RetentionDays.SIX_MONTHS,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
})
const datadogLogGroup = new logs.LogGroup(stack, 'DatadogLogGroup', {
  logGroupName: '/aws/cdk/ecs-alb-fargate-service-stack/datadog',
  retention: logs.RetentionDays.SIX_MONTHS,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
})

// Web Container
const web = taskDef.addContainer('Web', {
  image: ecs.ContainerImage.fromRegistry('httpd:2.4'),
  containerName: 'web',
  logging: new ecs.AwsLogDriver({
    streamPrefix: 'web',
    logGroup: webLogGroup,
  }),
})

web.addPortMappings({
  containerPort: 80,
  hostPort: 80,
  protocol: ecs.Protocol.TCP,
})

// Datadog Container
const ddApiKey = ecs.Secret.fromSecretsManager(
  secretsmanager.Secret.fromSecretNameV2(
    stack,
    'DatadogApiKey',
    'EcsAlbFargateServiceStackDDApiKey'
  )
)

taskDef.addContainer('Datadog', {
  image: ecs.ContainerImage.fromRegistry('public.ecr.aws/datadog/agent:latest'),
  memoryLimitMiB: 256,
  containerName: 'datadog',
  logging: ecs.LogDriver.awsLogs({
    streamPrefix: 'datadog',
    logGroup: datadogLogGroup,
  }),
  environment: {
    ECS_FARGATE: 'true',
  },
  secrets: {
    DD_API_KEY: ddApiKey,
  },
})

// Ecs Cluster
const cluster = new ecs.Cluster(stack, 'Cluster', {
  vpc,
  containerInsights: true,
})

// Alb FargateService
new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'EcsAlbFargateService', {
  cluster,
  desiredCount: 1,
  taskDefinition: taskDef,
  taskSubnets: {
    subnets: vpc.privateSubnets,
  },
  openListener: true,
  circuitBreaker: {
    rollback: true,
  },
})

app.synth()
