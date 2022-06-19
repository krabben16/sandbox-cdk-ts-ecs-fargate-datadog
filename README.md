# sandbox-cdk-ts-ecs-fargate-datadog
## build

```
cp .env.dist .env
yarn && yarn build
yarn cdk synth
```

## deploy
```
yarn cdk deploy
```

## fotrmat
```
yarn lint:fix
```
