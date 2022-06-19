import ec2 = require('aws-cdk-lib/aws-ec2');
import ecs = require('aws-cdk-lib/aws-ecs');
import ecs_patterns = require('aws-cdk-lib/aws-ecs-patterns');
import cdk = require('aws-cdk-lib');
import path = require('path');

const app = new cdk.App();
const stack = new cdk.Stack(app, 'FargateServiceWithLocalImage');

const vpc = new ec2.Vpc(stack, 'MyVpc', { cidr: '10.0.0.0/24', maxAzs: 2 });
const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

new ecs_patterns.ApplicationLoadBalancedFargateService(stack, "FargateService", {
  cluster,
  taskImageOptions: {
    image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, 'local-image'))
  },
});

app.synth();
