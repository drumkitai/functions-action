"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KuduServiceUtility = void 0;
const azure_app_kudu_service_1 = require("../Kudu/azure-app-kudu-service");
const core = require("@actions/core");
const path = require("path");
const fs = require("fs");
const deploymentFolder = 'site/deployments';
const manifestFileName = 'manifest';
const GITHUB_ZIP_DEPLOY = 'GITHUB_ZIP_DEPLOY_FUNCTIONS_V1';
class KuduServiceUtility {
    constructor(kuduService) {
        this._webAppKuduService = kuduService;
    }
    updateDeploymentStatus(taskResult, DeploymentID, customMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let requestBody = this._getUpdateHistoryRequest(taskResult, DeploymentID, customMessage);
                return yield this._webAppKuduService.updateDeployment(requestBody);
            }
            catch (error) {
                core.warning(error);
            }
        });
    }
    getDeploymentID() {
        if (this._deploymentID) {
            return this._deploymentID;
        }
        var deploymentID = `${process.env.GITHUB_SHA}` + Date.now().toString();
        return deploymentID;
    }
    deployUsingZipDeploy(packagePath, customMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('Package deployment using ZIP Deploy initiated.');
                let queryParameters = [
                    'isAsync=true',
                    'deployer=' + GITHUB_ZIP_DEPLOY
                ];
                var deploymentMessage = this._getUpdateHistoryRequest(null, null, customMessage).message;
                queryParameters.push('message=' + encodeURIComponent(deploymentMessage));
                let deploymentDetails = yield this._webAppKuduService.zipDeploy(packagePath, queryParameters);
                yield this._processDeploymentResponse(deploymentDetails);
                console.log('Successfully deployed web package to App Service.');
                return deploymentDetails.id;
            }
            catch (error) {
                core.error('Failed to deploy web package to App Service.');
                throw error;
            }
        });
    }
    deployUsingOneDeployFlex(packagePath, remoteBuild, customMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('Package deployment using One Deploy initiated.');
                let queryParameters = [
                    'remoteBuild=' + remoteBuild,
                    'deployer=' + GITHUB_ZIP_DEPLOY
                ];
                var deploymentMessage = this._getUpdateHistoryRequest(null, null, customMessage).message;
                queryParameters.push('message=' + encodeURIComponent(deploymentMessage));
                let deploymentDetails = yield this._webAppKuduService.oneDeployFlex(packagePath, queryParameters);
                yield this._processDeploymentResponse(deploymentDetails);
                console.log('Successfully deployed web package to Function App.');
                return deploymentDetails.id;
            }
            catch (error) {
                core.error('Failed to deploy web package to Function App.');
                throw error;
            }
        });
    }
    deployUsingWarDeploy(packagePath, customMessage, targetFolderName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('Package deployment using WAR Deploy initiated.');
                let queryParameters = [
                    'isAsync=true'
                ];
                if (targetFolderName) {
                    queryParameters.push('name=' + encodeURIComponent(targetFolderName));
                }
                var deploymentMessage = this._getUpdateHistoryRequest(null, null, customMessage).message;
                queryParameters.push('message=' + encodeURIComponent(deploymentMessage));
                let deploymentDetails = yield this._webAppKuduService.warDeploy(packagePath, queryParameters);
                yield this._processDeploymentResponse(deploymentDetails);
                console.log('Successfully deployed web package to App Service.');
                return deploymentDetails.id;
            }
            catch (error) {
                core.error('Failed to deploy web package to App Service.');
                throw error;
            }
        });
    }
    postZipDeployOperation(oldDeploymentID, activeDeploymentID) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                core.debug(`ZIP DEPLOY - Performing post zip-deploy operation: ${oldDeploymentID} => ${activeDeploymentID}`);
                let manifestFileContent = yield this._webAppKuduService.getFileContent(`${deploymentFolder}/${oldDeploymentID}`, manifestFileName);
                if (!!manifestFileContent) {
                    let tempManifestFile = path.join(`${process.env.RUNNER_TEMP}`, manifestFileName);
                    fs.writeFileSync(tempManifestFile, manifestFileContent);
                    yield this._webAppKuduService.uploadFile(`${deploymentFolder}/${activeDeploymentID}`, manifestFileName, tempManifestFile);
                }
                core.debug('ZIP DEPLOY - Performed post-zipdeploy operation.');
            }
            catch (error) {
                core.debug(`Failed to execute post zip-deploy operation: ${JSON.stringify(error)}.`);
            }
        });
    }
    warmpUp() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                core.debug('warming up Kudu Service');
                yield this._webAppKuduService.getAppSettings();
                core.debug('warmed up Kudu Service');
            }
            catch (error) {
                core.debug('Failed to warm-up Kudu: ' + error.toString());
            }
        });
    }
    _processDeploymentResponse(deploymentDetails) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var kuduDeploymentDetails = yield this._webAppKuduService.getDeploymentDetails(deploymentDetails.id);
                core.debug(`logs from kudu deploy: ${kuduDeploymentDetails.log_url}`);
                if (deploymentDetails.status == azure_app_kudu_service_1.KUDU_DEPLOYMENT_CONSTANTS.FAILED) {
                    yield this._printZipDeployLogs(kuduDeploymentDetails.log_url);
                }
                else {
                    console.log('Deploy logs can be viewed at %s', kuduDeploymentDetails.log_url);
                }
            }
            catch (error) {
                core.debug(`Unable to fetch logs for kudu Deploy: ${JSON.stringify(error)}`);
            }
            if (deploymentDetails.status == azure_app_kudu_service_1.KUDU_DEPLOYMENT_CONSTANTS.FAILED) {
                throw 'Package deployment using ZIP Deploy failed. Refer logs for more details.';
            }
        });
    }
    _printZipDeployLogs(log_url) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!log_url) {
                return;
            }
            var deploymentLogs = yield this._webAppKuduService.getDeploymentLogs(log_url);
            for (var deploymentLog of deploymentLogs) {
                console.log(`${deploymentLog.message}`);
                if (deploymentLog.details_url) {
                    yield this._printZipDeployLogs(deploymentLog.details_url);
                }
            }
        });
    }
    _getUpdateHistoryRequest(isDeploymentSuccess, deploymentID, customMessage) {
        deploymentID = !!deploymentID ? deploymentID : this.getDeploymentID();
        var message = {
            type: "deployment",
            sha: `${process.env.GITHUB_SHA}`,
            repoName: `${process.env.GITHUB_REPOSITORY}`,
            actor: `${process.env.GITHUB_ACTOR}`
        };
        if (!!customMessage) {
            // Append Custom Messages to original message
            for (var attribute in customMessage) {
                message[attribute] = customMessage[attribute];
            }
        }
        var deploymentLogType = message['type'];
        var active = false;
        if (deploymentLogType.toLowerCase() === "deployment" && isDeploymentSuccess) {
            active = true;
        }
        return {
            id: deploymentID,
            active: active,
            status: isDeploymentSuccess ? azure_app_kudu_service_1.KUDU_DEPLOYMENT_CONSTANTS.SUCCESS : azure_app_kudu_service_1.KUDU_DEPLOYMENT_CONSTANTS.FAILED,
            message: JSON.stringify(message),
            author: `${process.env.GITHUB_ACTOR}`,
            deployer: 'GitHub'
        };
    }
    deployWebAppImage(appName, images, isLinux) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                core.debug(`DeployWebAppImage - appName: ${appName}; images: ${images}; isLinux:${isLinux}`);
                console.log(`Deploying image ${images} to App Service ${appName}`);
                if (!images) {
                    throw 'The container image to be deployed to App Service is empty.';
                }
                let headers = isLinux ? { 'LinuxFxVersion': `DOCKER|${images}` } : { 'WindowsFxVersion': `DOCKER|${images}` };
                yield this._webAppKuduService.imageDeploy(headers);
                console.log('Successfully deployed image to App Service.');
            }
            catch (error) {
                core.error('Failed to deploy image to Web app Container.');
                throw error;
            }
        });
    }
}
exports.KuduServiceUtility = KuduServiceUtility;