import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib"
import { Construct } from "constructs"
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as ssm from "aws-cdk-lib/aws-ssm"
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns"
import * as ecs from "aws-cdk-lib/aws-ecs"
import * as logs from "aws-cdk-lib/aws-logs"
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'

export class EcsAlbFargateServiceStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: StackProps
  ) {
    super(scope, id, props)

    const vpcId = ssm.StringParameter.valueFromLookup(this, "/cdk/vpc/vpcId")
    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId })

    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 256,
      memoryLimitMiB: 512
    })

    // Cloudwatch Logs
    const webLogGroup = new logs.LogGroup(this, "WebLogGroup", {
      logGroupName: "/ecs/demo-app/web",
      retention: logs.RetentionDays.SIX_MONTHS,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const datadogLogGroup = new logs.LogGroup(this, "DatadogLogGroup", {
      logGroupName: "/ecs/demo-app/datadog",
      retention: logs.RetentionDays.SIX_MONTHS,
      removalPolicy: RemovalPolicy.DESTROY
    })

    // Web Container
    const webPort = 80

    const web = taskDef.addContainer("Web", {
      image: ecs.ContainerImage.fromRegistry("httpd:2.4"),
      containerName: "web",
      logging: new ecs.AwsLogDriver({
        streamPrefix: "web",
        logGroup: webLogGroup
      })
    })

    web.addPortMappings({
      containerPort: webPort,
      hostPort: webPort,
      protocol: ecs.Protocol.TCP
    })

    // Datadog Container
    const ddApiKey = ecs.Secret.fromSecretsManager(
      secretsmanager.Secret.fromSecretNameV2(this, "DatadogApiKey", "datadog-api-key"),
    )

    taskDef.addContainer("Datadog", {
      image: ecs.ContainerImage.fromRegistry("public.ecr.aws/datadog/agent:latest"),
      memoryLimitMiB: 256,
      containerName: "datadog",
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "datadog",
        logGroup: datadogLogGroup
      }),
      environment: {
        ECS_FARGATE: "true",
      },
      secrets: {
        DD_API_KEY: ddApiKey
      }
    })

    // Ecs Cluster
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      containerInsights: true
    })

    // Alb FargateService
    new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "FargateService",
      {
        cluster,
        desiredCount: 1,
        taskDefinition: taskDef,
        taskSubnets: {
          subnets: vpc.privateSubnets
        },
        openListener: true,
        circuitBreaker: {
          rollback: true
        },
      }
    )
  }
}
