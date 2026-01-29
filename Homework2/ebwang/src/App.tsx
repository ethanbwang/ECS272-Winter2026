import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import ParallelCoordinate from './components/ParallelCoordinate';
import ScatterPlot from './components/ScatterPlot';
import BarGraph from './components/BarGraph';
import { useState } from 'react';

const theme = createTheme({
  palette: {
    background: {
      default: '#F6F7F8',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#191414',
      secondary: '#5F6368',
    },
    divider: '#E4E6EB',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    h5: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
  },
});


// Chart card wrapping each visualization component
function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Paper
      elevation={1}
      sx={{
        height: '100%',
        minHeight: 0,
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flex: '0 0 auto'
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            textAlign: 'center',
            color: 'text.secondary',
            bgcolor: 'background.paper',
          }}
        >
          {title}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, p: 1 }}>
        <Box className="chart-container">{children}</Box>
      </Box>
    </Paper>
  );
}

function Layout() {
  // For next homework, can set this title through interactions where the user
  // can pick an artist and set the number of tracks to show
  const [barTitle, setBarTitle] = useState<string>("Top 10 Tracks for Taylor Swift Ranked by Popularity");

  return (
    <Box
      id="main-container"
      sx={{
        height: '100vh',
        p: 2,
        boxSizing: 'border-box',
        bgcolor: 'background.default',
      }}
    >
      <Stack spacing={1.5} sx={{ height: '100%', minHeight: 0 }}>
        {/* Title */}
        <Box
          sx={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 0.5,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Spotify Artist Trends for Discovery
          </Typography>
        </Box>

        {/* Main focus */}
        <Box sx={{ flex: 6, minHeight: 0 }}>
          <ChartCard title="Artist Statistics">
            <ParallelCoordinate />
          </ChartCard>
        </Box>

        {/* Supporting charts */}
        <Box sx={{ flex: 4, minHeight: 0 }}>
          <Grid container spacing={1.5} sx={{ height: '100%', minHeight: 0 }}>
            <Grid size={{ xs: 12, md: 8 }} sx={{ height: '100%', minHeight: 0 }}>
              <ChartCard title="Track Popularity vs Artist Followers">
                <ScatterPlot />
              </ChartCard>
            </Grid>

            {/*
              Demonstration of a drill-down (e.g. if the user clicks on a
              point in the scatter plot
            */}
            <Grid size={{ xs: 12, md: 4 }} sx={{ height: '100%', minHeight: 0 }}>
              <ChartCard title={barTitle}>
                <BarGraph setBarTitle={setBarTitle} />
              </ChartCard>
            </Grid>
          </Grid>
        </Box>
      </Stack>
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <Layout />
    </ThemeProvider>
  );
}
