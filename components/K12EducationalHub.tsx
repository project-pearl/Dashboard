'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, Fish, Waves, Droplets, Sparkles, BookOpen, 
  FlaskConical, TrendingUp, AlertTriangle, Heart
} from 'lucide-react';

interface K12EducationalHubProps {
  data: any;
  isTeacher: boolean;
}

const DID_YOU_KNOW_TIPS = [
  "🐟 Fish need at least 5 mg/L of dissolved oxygen to survive - just like you need air to breathe!",
  "🌊 One inch of rain over one acre of land equals 27,154 gallons of water - that's 340 bathtubs!",
  "🦪 A single oyster can filter up to 50 gallons of water per day - nature's water purifier!",
  "🌱 Underwater grass beds (SAV) need sunlight to grow, but murky water blocks it like curtains on a window.",
  "💧 Storm drains lead directly to rivers and bays - everything you pour down them goes straight to fish habitat!",
  "🐢 Sea turtles like Sweet Pea need clean water to hunt for food - turbidity is like hunting in fog.",
  "🦀 Blue crabs need a specific salinity range (10-30 ppt) - too fresh or too salty and they struggle.",
  "🌡️ Water temperature affects dissolved oxygen - warmer water holds less oxygen, like warm soda losing fizz.",
  "☀️ Algae blooms block sunlight underwater, creating 'dead zones' where nothing can live.",
  "🏃 Nitrogen from fertilizers acts like energy drinks for algae - too much causes explosive growth.",
  "🐠 Total Suspended Solids (TSS) is basically dirt and particles floating in water - like swimming in chocolate milk.",
  "🦆 Waterfowl like ducks and geese can tell water quality by taste - they avoid polluted areas.",
  "🌾 Wetlands are nature's kidneys - they filter pollutants before water reaches the bay.",
  "⚡ Lightning during storms can actually add nitrogen to water - nature's fertilizer delivery system!",
  "🐚 Baby oysters (spat) are extremely sensitive to pollution - clean water = more oysters.",
  "🌊 Tides mix saltwater and freshwater creating 'brackish' water - a unique habitat for special species.",
  "🦈 Even sharks need clean water! Bull sharks in the Chesapeake Bay rely on healthy tributaries.",
  "🌧️ First flush of a storm carries the most pollution - the first 30 minutes are the dirtiest.",
  "🐟 Striped bass (rockfish) migration patterns follow dissolved oxygen levels - they avoid low-DO zones.",
  "🔬 Scientists use parts per million (ppm) and milligrams per liter (mg/L) - they're the same thing!"
];

const SCIENCE_FAIR_PROJECTS = [
  {
    title: "Water Quality Detective",
    difficulty: "Beginner",
    grade: "6-8",
    description: "Compare water samples from different locations (storm drain, creek, tap water). Test turbidity, pH, and temperature. Which is cleanest? Why?",
    materials: ["Clear jars", "pH strips", "Thermometer", "Ruler (for turbidity)"],
    hypothesis: "Storm drain water will have higher turbidity than creek water."
  },
  {
    title: "Oyster Filtration Experiment",
    difficulty: "Intermediate",
    grade: "7-10",
    description: "Create mini-filtration systems with and without oyster shells. Add muddy water and measure clarity over time. How effective are oysters?",
    materials: ["2 containers", "Crushed oyster shells", "Muddy water", "Timer", "Turbidity tube"],
    hypothesis: "Oyster shells will reduce water turbidity by 30% or more in 24 hours."
  },
  {
    title: "Stormwater Runoff Model",
    difficulty: "Intermediate",
    grade: "6-9",
    description: "Build model landscapes (grass, pavement, gravel). Simulate rain and collect runoff. Which surface creates the dirtiest runoff?",
    materials: ["3 trays", "Grass sod", "Gravel", "Asphalt sample", "Spray bottle", "Collection cups"],
    hypothesis: "Pavement will produce runoff with 5x more sediment than grass."
  },
  {
    title: "Dissolved Oxygen vs Temperature",
    difficulty: "Advanced",
    grade: "9-12",
    description: "Measure DO at different water temperatures. Create a chart showing the relationship. Why does this matter for fish?",
    materials: ["DO meter", "Thermometer", "Water samples", "Ice", "Hot plate", "Graphing tools"],
    hypothesis: "Dissolved oxygen decreases as water temperature increases."
  },
  {
    title: "Nutrient Pollution Impact",
    difficulty: "Advanced",
    grade: "10-12",
    description: "Grow algae in water with different fertilizer concentrations. Measure growth rate and oxygen levels. Model a 'dead zone.'",
    materials: ["Algae culture", "Fertilizer (N, P)", "Beakers", "Light source", "DO meter"],
    hypothesis: "High nitrogen levels will cause algae blooms and reduce dissolved oxygen."
  }
];

const BAY_PERSPECTIVE_FACTS = [
  {
    icon: "🐟",
    species: "Striped Bass (Rockfish)",
    needs: "DO > 5 mg/L, salinity 10-20 ppt",
    impact: "Low DO forces them into shallow water where they're easier to catch (overfishing risk)."
  },
  {
    icon: "🦀",
    species: "Blue Crab",
    needs: "Salinity 10-30 ppt, clear water for hunting",
    impact: "High turbidity makes it hard to find food - imagine hunting with blurry vision!"
  },
  {
    icon: "🦪",
    species: "Eastern Oyster",
    needs: "Salinity 10-28 ppt, low sediment",
    impact: "TSS clogs their gills - like trying to breathe through a dusty mask."
  },
  {
    icon: "🌱",
    species: "Submerged Aquatic Vegetation (SAV)",
    needs: "Turbidity < 15 NTU for sunlight",
    impact: "Murky water blocks sunlight = no photosynthesis = grass dies = fish lose habitat."
  },
  {
    icon: "🐢",
    species: "Diamondback Terrapin",
    needs: "Brackish water (5-20 ppt), clean substrate",
    impact: "Nutrient pollution causes algae mats that trap and drown baby turtles."
  }
];

export function K12EducationalHub({ data, isTeacher }: K12EducationalHubProps) {
  const [selectedTab, setSelectedTab] = useState<'tips' | 'projects' | 'bay'>('tips');
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const nextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % DID_YOU_KNOW_TIPS.length);
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Student Learning Center
        </CardTitle>
        <CardDescription>
          Science projects, water quality tips, and bay ecosystem perspectives for K-12 learners
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={selectedTab === 'tips' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('tips')}
            className="flex-1"
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            Did You Know?
          </Button>
          <Button
            size="sm"
            variant={selectedTab === 'projects' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('projects')}
            className="flex-1"
          >
            <FlaskConical className="h-4 w-4 mr-2" />
            Science Fair
          </Button>
          <Button
            size="sm"
            variant={selectedTab === 'bay' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('bay')}
            className="flex-1"
          >
            <Fish className="h-4 w-4 mr-2" />
            Bay Life
          </Button>
        </div>

        {/* Did You Know Tips */}
        {selectedTab === 'tips' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-blue-100 to-cyan-100 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-blue-900 mb-2">
                    Did You Know? ({currentTipIndex + 1} of {DID_YOU_KNOW_TIPS.length})
                  </div>
                  <div className="text-sm text-blue-800 leading-relaxed">
                    {DID_YOU_KNOW_TIPS[currentTipIndex]}
                  </div>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={nextTip}
                className="mt-3 w-full"
              >
                Next Tip →
              </Button>
            </div>

            <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded p-3">
              <span className="font-semibold">💡 Teacher Tip:</span> Use these facts as daily warm-ups, 
              exit tickets, or discussion starters. Students can research deeper and present findings to the class!
            </div>
          </div>
        )}

        {/* Science Fair Projects */}
        {selectedTab === 'projects' && (
          <div className="space-y-3">
            {SCIENCE_FAIR_PROJECTS.map((project, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800">{project.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {project.difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Grade {project.grade}
                      </Badge>
                    </div>
                  </div>
                  <FlaskConical className="h-5 w-5 text-purple-600 flex-shrink-0" />
                </div>
                
                <div className="text-xs text-slate-700 leading-relaxed mb-2">
                  {project.description}
                </div>
                
                <div className="text-xs">
                  <span className="font-semibold text-slate-700">Materials:</span>{' '}
                  <span className="text-slate-600">{project.materials.join(', ')}</span>
                </div>
                
                <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded p-2">
                  <span className="font-semibold text-blue-900">Hypothesis Example:</span>{' '}
                  <span className="text-blue-800">{project.hypothesis}</span>
                </div>
              </div>
            ))}
            
            <div className="text-xs text-slate-600 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded p-3">
              <span className="font-semibold">🔬 For Teachers:</span> These projects align with NGSS standards 
              (MS-ESS3-3, HS-ESS3-4). Use real PEARL dashboard data as baseline for student experiments. 
              Contact us for classroom kits and virtual field trips!
            </div>
          </div>
        )}

        {/* Bay Ecosystem Perspective */}
        {selectedTab === 'bay' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Waves className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-semibold text-slate-800">
                  How Water Quality Affects Bay Life
                </span>
              </div>
              <div className="text-xs text-slate-700 leading-relaxed">
                Every number on this dashboard means something to the creatures living in the bay. 
                Here's what different species need to survive and thrive:
              </div>
            </div>

            {BAY_PERSPECTIVE_FACTS.map((fact, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{fact.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800 mb-1">
                      {fact.species}
                    </div>
                    <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mb-2 inline-block">
                      <Heart className="h-3 w-3 inline mr-1" />
                      Needs: {fact.needs}
                    </div>
                    <div className="text-xs text-slate-700 leading-relaxed">
                      <span className="font-semibold">Impact of Poor Water Quality:</span> {fact.impact}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Current Conditions for Bay Life — only when waterbody data is available */}
            {data?.parameters && (
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-lg p-3">
              <div className="text-sm font-semibold text-cyan-900 mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Right Now in This Water
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">Dissolved Oxygen:</span>
                  <span className={`font-bold ${data.parameters.DO.value >= 5 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.parameters.DO.value >= 5 ? '✓ Fish can breathe!' : '⚠️ Fish stressed!'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">Turbidity:</span>
                  <span className={`font-bold ${data.parameters.turbidity.value < 15 ? 'text-green-600' : 'text-orange-600'}`}>
                    {data.parameters.turbidity.value < 15 ? '✓ SAV can grow!' : '⚠️ Too cloudy for grass!'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">Salinity:</span>
                  <span className="font-bold text-blue-600">
                    {data.parameters.salinity.value.toFixed(1)} ppt - {
                      data.parameters.salinity.value < 10 ? 'Freshwater habitat' :
                      data.parameters.salinity.value < 20 ? 'Perfect for crabs!' :
                      'Saltier, oyster territory'
                    }
                  </span>
                </div>
              </div>
            </div>
            )}

            <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded p-3">
              <span className="font-semibold">🌊 Activity Idea:</span> Pick one species above. 
              Track water quality for a week. Would this species thrive today? What about yesterday? 
              Graph your findings and explain the trends!
            </div>
          </div>
        )}

        {/* Teacher Resources Footer */}
        {isTeacher && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <BookOpen className="h-5 w-5 text-amber-700 flex-shrink-0" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <span className="font-semibold block mb-1">Teacher Resources Available:</span>
                • Downloadable worksheets aligned to NGSS standards<br/>
                • Virtual field trip to ALIA monitoring sites<br/>
                • Classroom sensor kit loan program<br/>
                • Guest speaker requests (scientists, engineers)<br/>
                • Student data collection projects (contribute to real research!)
                <div className="mt-2">
                  <Button size="sm" variant="outline" className="text-xs h-7">
                    Request Teacher Pack
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
