import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';

import { SelectedArtistContext } from './context/SelectedArtistContext';
import { RandomTrackProvider, useRandomTrack } from './context/RandomTrackContext';
import ParallelCoordinate from './components/ParallelCoordinate';
import ScatterPlot from './components/ScatterPlot';
import BarGraph from './components/BarGraph';
import { NumTracksContext } from './context/NumTracksContext';

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
  dimmed = false,
}: {
  title: string;
  children: React.ReactNode;
  dimmed?: boolean;
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
        ...(dimmed && {
          opacity: 0.5,
          pointerEvents: 'none',
        }),
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


function LayoutContent() {
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [numTracks, setNumTracks] = useState<number | null>(null);
  const { requestRandomTrack } = useRandomTrack();
  const barTitle = useMemo(
    () => {
      if (selectedArtist !== null) {
        return `Top ${numTracks} Tracks for ${selectedArtist} Ranked by Popularity`;
      } else {
        return `Select a Point in the Scatter Plot to View Artist Tracks`;
      }
    },
    [selectedArtist, numTracks]
  );

  const parallelTitle = useMemo(
    () => {
      if (selectedArtist !== null) {
        return `Artist Statistics for ${selectedArtist}`;
      } else {
        return `Artist Statistics (All Artists)`;
      }
    },
    [selectedArtist]
  );

  return (
    <SelectedArtistContext.Provider value={{ selectedArtist, setSelectedArtist }}>
      <NumTracksContext.Provider value={{ numTracks, setNumTracks }}>
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
            {/* Title and Random Track button */}
            <Box
              sx={{
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                py: 0.5,
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Discover New Spotify Artists and Their Work
              </Typography>
              <Box
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <Button
                  variant="contained"
                  onClick={requestRandomTrack}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    bgcolor: '#1DB954',
                    '&:hover': { bgcolor: '#1aa34a' },
                  }}
                >
                  Random Track
                </Button>
              </Box>
            </Box>

            {/* Main focus */}
            <Box sx={{ flex: 6, minHeight: 0 }}>
              <ChartCard title="Track Popularity vs Artist Followers">
                <ScatterPlot />
              </ChartCard>
            </Box>

            {/* Supporting charts */}
            <Box sx={{ flex: 4, minHeight: 0 }}>
              <Grid container spacing={1.5} sx={{ height: '100%', minHeight: 0 }}>
                <Grid size={{ xs: 12, md: 8 }} sx={{ height: '100%', minHeight: 0 }}>
                  <ChartCard title={parallelTitle}>
                    <ParallelCoordinate />
                  </ChartCard>
                </Grid>

                {/*
              Demonstration of a drill-down (e.g. if the user clicks on a
              point in the scatter plot
            */}
                <Grid size={{ xs: 12, md: 4 }} sx={{ height: '100%', minHeight: 0 }}>
                  <ChartCard title={barTitle} dimmed={!selectedArtist}>
                    <BarGraph />
                  </ChartCard>
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </Box>
      </NumTracksContext.Provider>
    </SelectedArtistContext.Provider>
  );
}

function Layout() {
  return (
    <RandomTrackProvider>
      <LayoutContent />
    </RandomTrackProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <Layout />
    </ThemeProvider>
  );
}
