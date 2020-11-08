# webhook-cron-api

## Installation

Download the git repo and run `npm i` to install

## Running

You can start the app with:

`npm start`

## Usage

### Authorization

Each request requires an `auth` parameter (GET or POST), which is set as an env variable (`process.env.AUTHKEY`). The default is `xy0cWP` for testing (PLEASE OVERRIDE THIS WITH AN ENV VARIABLE).
 
### Creating a new job

New jobs are made via a request to `/new`. These can be GET or POST requests.

**Example:**

```
http://localhost:5000/new?cron=*%20*%20*%20*%20*&url=https://google.com/&auth=xy0cWP
```

Returns: `eljhxgpacsajpt`

Alternative POST format:

`POST /new`

```
{
  url: 'http://google.com/',
  cron: '* * * * *',
  auth: 'xy0cWP'
}
```

Returns: `eljhxgpacsajpt`

--

The response to this request will be a unique job ID, which is required to view the status of a job or delete a job.

You can use https://crontab.guru/ to check your cron expressions. They will be validated, along with the URL supplied.

### Deleting a job

You can delete a job by running:

```
http://localhost:5000/del?key=eljhxgpacsajpt&auth=xy0cWP
```

Returns a status (200 or 400) & response text.

### List jobs

You can view all jobs with:

```
http://localhost:5000/jobs?auth=xy0cWP
```

This will include the timestamp of when the job was `created`, last `executed`, and whether it is currently `running` or not.

**Example Response:**

```
{
   "eljhxgpacsajpt":{
      "url":"https://google.com/",
      "cron":"* * * * *",
      "created":1604811423913,
      "executed":1604813280350,
      "running":true
   }
}
```

### View the status of a specific job

You can view the status of a specific job by key without authorization.

The request format is: GET `/job/<key>`

**Example:**

```
http://localhost:5000/job/eljhxgpacsajpt
```

**Example Response:**

```
{
   "eljhxgpacsajpt":{
      "url":"https://google.com/",
      "cron":"* * * * *",
      "created":1604811423913,
      "executed":1604813280350,
      "running":true
   }
}
```
