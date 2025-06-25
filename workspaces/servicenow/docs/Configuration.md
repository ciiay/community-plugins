# Configuration

This document describes the configuration for the ServiceNow backend plugin.

## Prerequisites

You need to have a ServiceNow developer instance. You can request a new one from the [ServiceNow Developer Portal](https://developer.servicenow.com/dev.do#!/learn/learning-plans/washingtondc/new_to_servicenow/app_store_learnv2_buildmyfirstapp_washingtondc_personal_developer_instances).

## `app-config.yaml`

To use the ServiceNow backend plugin, you need to configure it in your `app-config.local.yaml` file. The plugin supports both Basic Authentication and OAuth with grant types "password" and "client_credentials".

### Basic Authentication

You can use basic authentication with your ServiceNow admin username and password.

```yaml
servicenow:
  instanceUrl: https://<your-dev-instance>.service-now.com
  basicAuth:
    username: admin
    password: <your-password>
```

### OAuth 2.0 Authentication

The plugin supports two OAuth grant types: `password` and `client_credentials`.

#### Password Grant Type

This grant type requires your admin username, password, client ID, and client secret.

1.  **Create an OAuth configuration in ServiceNow:**

    - In the ServiceNow UI, navigate to **All** -> **Application registry**.
    - Click **New** and select **Create an OAuth API endpoint for external clients**.
    - Fill in the form:
      - **Name:** `oauth` (or any desired name)
      - **Client Secret:** `mysecret` (or any desired value)
      - **Client Type:** Integration as a User (in the dropdown)
    - Copy the **Client ID** and submit the form.

2.  **Enable the password grant type system property:**

    - Navigate to `https://<your-instance-url>/sys_properties_list.do`.
    - Search for the property `glide.oauth.password_grant.enabled`. If it doesn't exist, create it.
    - Set the following values:
      - **Name:** `glide.oauth.password_grant.enabled`
      - **Type:** `true | false`
      - **Value:** `true`
    - Submit the form.

3.  **Update your `app-config.yaml`:**

    ```yaml
    servicenow:
      instanceUrl: https://<your-dev-instance>.service-now.com
      oauth:
        grantType: password
        clientId: <your-client-id>
        clientSecret: <your-client-secret>
        username: admin
        password: <your-admin-password>
    ```

#### Client Credentials Grant Type

This grant type allows authentication using only a client ID and client secret, without an admin password in the configuration.

1.  **Create an OAuth configuration in ServiceNow:**

    - In the ServiceNow UI, navigate to **All** -> **Application registry**.
    - Click **New** and select **Create an OAuth API endpoint for external clients**.
    - Fill in the form:
      - **Name:** `oauth` (or any desired name)
      - **Client Secret:** `mysecret` (or any desired value)
      - **Client Type:** Integration as a Service (in the dropdown)
    - Copy the **Client ID** and submit the form.
    - Assign an admin user to the OAuth configuration.

2.  **Enable the necessary system properties:**

    - Enable `glide.oauth.provider.enabled` and `glide.oauth.client_credentials.grant.enabled`.
    - Navigate to `https://<your-instance-url>/sys_properties_list.do`.
    - Ensure both properties are present and set to `true`. If they don't exist, create them.

3.  **Update your `app-config.yaml`:**

    ```yaml
    servicenow:
      instanceUrl: https://<your-dev-instance>.service-now.com
      oauth:
        grantType: client_credentials
        clientId: <your-client-id>
        clientSecret: <your-client-secret>
    ```
