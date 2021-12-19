import axios from 'axios';
import { useState, useEffect } from 'react';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import TextareaAutosize from '@mui/material/TextareaAutosize';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Grid from '@mui/material/Grid';

import styles from './App.module.css';

window.axios = axios;

let fetchGithubBranchesTimeout = null;
let abortController = null;

export default function App() {
  const [ username, setUsername ] = useState('');
  const [ repo, setRepo ] = useState('');
  const [ branch, setBranch ] = useState('');
  const [ branches, setBranches ] = useState([]);
  const [ binRootURL, setBinRootURL ] = useState('');
  const [ codesandboxId, setCodeSandboxId ] = useState(null);
  const [ deployLoading, setDeployLoading ] = useState(false);

  const handleInputChange = (value, type) => {
    if(type === 'username') { setUsername(value.trim()) }
    if(type === 'repo') { setRepo(value.trim()) }
    if(type === 'branch') { setBranch(value) }
    if(type === 'binRootURL') { setBinRootURL(value) }
  }

  const handleDeploy = async () => {
    if(!username || !repo || !branch) { return }
    try {
      setDeployLoading(true);
      const params = { files: {} };
      // get all file path recursively in git root dir
      const filePaths = await axios.get(`https://api.github.com/repos/${username}/${repo}/git/trees/${branch}?recursive=1`)
        .then(({ data }) => data.tree.filter(file => file.type === 'blob').map(file => file.path));
      console.log('filePaths: ', filePaths);
      // add file to params
      for(let filePath of filePaths) {
        const githubFileUrlRoot = 'https://raw.githubusercontent.com';
        const githubFileUrl = `${githubFileUrlRoot}/${username}/${repo}/${branch}/${filePath}`;
        const customFileUrl = `${binRootURL || githubFileUrlRoot}/${username}/${repo}/${branch}/${filePath}`;
        const githubFileRes = await axios.get(githubFileUrl);
        // for text file
        const isTextFile = /^text\//.test(githubFileRes.headers['content-type']);
        if(isTextFile) {
          params.files[filePath] = {
            content: githubFileRes.data,
            isBinary: false
          };
        }
        // files other than text file
        if(!isTextFile) {
          params.files[filePath] = {
            content: customFileUrl,
            isBinary: true
          };
        }
      }
      console.log('params: ', params);
      // deploy to Codesandbox
      const sandboxData = await axios.post('https://codesandbox.io/api/v1/sandboxes/define?json=1', params).then(({ data }) => data);
      setCodeSandboxId(sandboxData.sandbox_id);
    } catch(error) {
      console.log('Error occured:', error);
    }
    setDeployLoading(false);
  }

  const branchSelect = (branch, branches, setBranch) => {
    return (
      <Select
        value={branch}
        label="Github Branches"
        onChange={e => handleInputChange(e.target.value, 'branch')}
      >
        {branches.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
      </Select>
    );
  }

  const fetchGithubBranches = () => {
    clearTimeout(fetchGithubBranchesTimeout);
    fetchGithubBranchesTimeout = null;
    if(abortController) { abortController.abort(); abortController = null; }
    abortController = new AbortController();
    return axios.get(`https://api.github.com/repos/${username}/${repo}/branches`, { signal: abortController.signal })
      .then(({ data }) => {
        setBranches(data.map(branch => branch.name));
        if(data.find(branch => branch.name === 'master')) { setBranch('master') }
        else { setBranch('') }
      })
      .catch(() => {
        setBranches([]);
        setBranch('');
      })
      .then(() => {
        abortController = null;
      });
  }

  useEffect(() => {
    if(!username || !repo) { return }
    if(fetchGithubBranchesTimeout) { clearTimeout(fetchGithubBranchesTimeout); fetchGithubBranchesTimeout = null; }
    fetchGithubBranchesTimeout = setTimeout(fetchGithubBranches, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ username, repo ]);

  useEffect(() => {
    setCodeSandboxId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, repo, branch]);

  return (
    <Container maxWidth="lg" className={styles.container}>
      <h1 className={styles.header}>Deploy your code on Github to CodeSandbox for website embeding</h1>
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={5}>
          <Grid item xs={3}>
            <TextField label="Github Username" value={username} onChange={e => handleInputChange(e.target.value, 'username')} fullWidth variant="outlined" />
          </Grid>
          <Grid item xs={3}>
            <TextField label="Github Repo" value={repo} onChange={e => handleInputChange(e.target.value, 'repo')} fullWidth variant="outlined" />
          </Grid>
          <Grid item xs={3}>
            <FormControl fullWidth disabled={!branches.length}>
              <InputLabel id="demo-simple-select-label">Branches</InputLabel>
              {branchSelect(branch, branches, setBranch)}
            </FormControl>
          </Grid>
          <Grid item xs={3}>
            <TextField label="Binary Root URL" value={binRootURL} helperText="if not specificed, default to https://raw.githubusercontent.com" onChange={e => handleInputChange(e.target.value, 'binRootURL')} fullWidth variant="outlined" />
          </Grid>
          <Grid item xs={2}>
            <Button variant="outlined" onClick={handleDeploy} disabled={deployLoading || !username || !repo || !branch}>
              {deployLoading ? <CircularProgress /> : 'Deploy to CodeSandbox' }
            </Button>
          </Grid>
        </Grid>
      </Box>
      {codesandboxId ? (
        <div>
          <p>Sandbox ID: {codesandboxId}</p>
          <TextareaAutosize
            aria-label="Embed Code"
            minRows={5}
            placeholder="Embed iframe code"
            style={{ width: 300 }}
            value={`<iframe
  src="https://codesandbox.io/embed/${codesandboxId}?view=split"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>`}
          />
          <iframe
            title="Codesandbox"
            src={`https://codesandbox.io/embed/${codesandboxId}?view=split`}
            style={{width: '100%', height: '500px', border: 0, borderRadius: '4px', overflow: 'hidden'}}
            allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          ></iframe>
        </div>
      ) : null}
    </Container>
  );
}