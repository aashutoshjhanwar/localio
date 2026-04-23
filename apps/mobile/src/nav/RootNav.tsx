import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAuth } from '../state/auth';
import { Api } from '../api/client';
import { LoginScreen } from '../screens/Login';
import { FeedScreen } from '../screens/Feed';
import { ListingDetailScreen } from '../screens/ListingDetail';
import { CreateListingScreen } from '../screens/CreateListing';
import { CreateServiceScreen } from '../screens/CreateService';
import { ChatListScreen } from '../screens/ChatList';
import { ChatRoomScreen } from '../screens/ChatRoom';
import { ServicesScreen } from '../screens/Services';
import { ServiceDetailScreen } from '../screens/ServiceDetail';
import { BookingsScreen } from '../screens/Bookings';
import { FavoritesScreen } from '../screens/Favorites';
import { CompareListingsScreen } from '../screens/CompareListings';
import { NotificationPrefsScreen } from '../screens/NotificationPrefs';
import { MyItemsScreen } from '../screens/MyItems';
import { AdminScreen } from '../screens/Admin';
import { EditListingScreen } from '../screens/EditListing';
import { UserProfileScreen } from '../screens/UserProfile';
import { InboxScreen } from '../screens/Inbox';
import { CategoriesScreen } from '../screens/Categories';
import { CategoryFeedScreen } from '../screens/CategoryFeed';
import { JoinSocietyScreen } from '../screens/JoinSociety';
import { BlocksScreen } from '../screens/Blocks';
import { EventsScreen } from '../screens/Events';
import { EventDetailScreen } from '../screens/EventDetail';
import { CreateEventScreen } from '../screens/CreateEvent';
import { SavedSearchesScreen } from '../screens/SavedSearches';
import { PostsScreen } from '../screens/Posts';
import { PostDetailScreen } from '../screens/PostDetail';
import { CreatePostScreen } from '../screens/CreatePost';
import { PollsScreen } from '../screens/Polls';
import { PollDetailScreen } from '../screens/PollDetail';
import { CreatePollScreen } from '../screens/CreatePoll';
import { ManageSlotsScreen } from '../screens/ManageSlots';
import { InviteScreen } from '../screens/Invite';
import { AnalyticsScreen } from '../screens/Analytics';
import { FollowingScreen } from '../screens/Following';
import { MapViewScreen } from '../screens/MapView';
import { WantedScreen } from '../screens/Wanted';
import { CreateWantedScreen } from '../screens/CreateWanted';
import { WantedDetailScreen } from '../screens/WantedDetail';
import { KycScreen } from '../screens/Kyc';
import { AdminKycScreen } from '../screens/AdminKyc';
import { SearchScreen } from '../screens/Search';
import { ProfileScreen } from '../screens/Profile';
import { OffersInboxScreen } from '../screens/OffersInbox';
import { DealsScreen } from '../screens/Deals';
import { theme } from '../theme';
import { useT } from '../i18n';

export type RootStackParamList = {
  Tabs: undefined;
  ListingDetail: { id: string };
  ServiceDetail: { id: string };
  CreateListing: { dupeFromId?: string } | undefined;
  CreateService: undefined;
  ChatRoom: { conversationId: string; title?: string };
  Favorites: undefined;
  CompareListings: { ids: string[] };
  NotificationPrefs: undefined;
  MyItems: undefined;
  Admin: undefined;
  EditListing: { id: string };
  UserProfile: { id: string };
  Inbox: undefined;
  Categories: undefined;
  CategoryFeed: { tab: 'listings' | 'services'; key: string; label: string };
  JoinSociety: undefined;
  Blocks: undefined;
  Events: undefined;
  EventDetail: { id: string };
  CreateEvent: undefined;
  SavedSearches: undefined;
  Posts: undefined;
  PostDetail: { id: string };
  CreatePost: undefined;
  Polls: undefined;
  PollDetail: { id: string };
  CreatePoll: undefined;
  ManageSlots: { serviceId: string; title?: string };
  Invite: undefined;
  Analytics: undefined;
  MapView: undefined;
  Following: undefined;
  Wanted: undefined;
  CreateWanted: undefined;
  WantedDetail: { id: string };
  Kyc: undefined;
  AdminKyc: undefined;
  Search: undefined;
  OffersInbox: undefined;
  Deals: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Tabs() {
  const t = useT();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let live = true;
    const tick = () => {
      Api.chatUnread().then((r) => { if (live) setUnread(r.unread); }).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => { live = false; clearInterval(id); };
  }, []);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTitleStyle: { color: theme.colors.text, fontWeight: '700' },
        tabBarIcon: ({ color, size }) => {
          const m: Record<string, string> = {
            Feed: '🏘️', Services: '🛠️', Bookings: '📅', Chats: '💬', Profile: '👤',
          };
          return <Text style={{ fontSize: size, color }}>{m[route.name] ?? '•'}</Text>;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: t('tab_feed') }} />
      <Tab.Screen name="Services" component={ServicesScreen} options={{ title: t('tab_services') }} />
      <Tab.Screen name="Bookings" component={BookingsScreen} options={{ title: t('tab_bookings') }} />
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{ title: t('tab_chats'), tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tab_profile') }} />
    </Tab.Navigator>
  );
}

export function RootNav() {
  const token = useAuth((s) => s.token);
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.colors.bg } }}>
      {!token ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: 'Listing' }} />
          <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} options={{ title: 'Service' }} />
          <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Saved' }} />
          <Stack.Screen name="CompareListings" component={CompareListingsScreen} options={{ title: 'Compare' }} />
          <Stack.Screen name="NotificationPrefs" component={NotificationPrefsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="MyItems" component={MyItemsScreen} options={{ title: 'My posts' }} />
          <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Moderation' }} />
          <Stack.Screen name="EditListing" component={EditListingScreen} options={{ title: 'Edit listing' }} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="Inbox" component={InboxScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Browse categories' }} />
          <Stack.Screen name="CategoryFeed" component={CategoryFeedScreen} />
          <Stack.Screen name="JoinSociety" component={JoinSocietyScreen} options={{ title: 'Join a society' }} />
          <Stack.Screen name="Blocks" component={BlocksScreen} options={{ title: 'Blocked users' }} />
          <Stack.Screen name="Events" component={EventsScreen} options={{ title: 'Events nearby' }} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
          <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Create event' }} />
          <Stack.Screen name="SavedSearches" component={SavedSearchesScreen} options={{ title: 'Saved searches' }} />
          <Stack.Screen name="Posts" component={PostsScreen} options={{ title: 'Ask the neighborhood' }} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post' }} />
          <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ title: 'New post' }} />
          <Stack.Screen name="Polls" component={PollsScreen} options={{ title: 'Polls nearby' }} />
          <Stack.Screen name="PollDetail" component={PollDetailScreen} options={{ title: 'Poll' }} />
          <Stack.Screen name="CreatePoll" component={CreatePollScreen} options={{ title: 'New poll' }} />
          <Stack.Screen name="Invite" component={InviteScreen} options={{ title: 'Invite neighbors' }} />
          <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
          <Stack.Screen name="MapView" component={MapViewScreen} options={{ title: 'Nearby map' }} />
          <Stack.Screen name="Following" component={FollowingScreen} options={{ title: 'Following' }} />
          <Stack.Screen name="Wanted" component={WantedScreen} options={{ title: 'Wanted nearby' }} />
          <Stack.Screen name="CreateWanted" component={CreateWantedScreen} options={{ title: 'Post a request' }} />
          <Stack.Screen name="WantedDetail" component={WantedDetailScreen} options={{ title: 'Request' }} />
          <Stack.Screen name="Kyc" component={KycScreen} options={{ title: 'Verify identity' }} />
          <Stack.Screen name="AdminKyc" component={AdminKycScreen} options={{ title: 'KYC review' }} />
          <Stack.Screen
            name="ManageSlots"
            component={ManageSlotsScreen}
            options={({ route }) => ({ title: (route.params as any)?.title ? `Slots · ${(route.params as any).title}` : 'Availability slots' })}
          />
          <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
          <Stack.Screen name="OffersInbox" component={OffersInboxScreen} options={{ title: 'Offers' }} />
          <Stack.Screen name="Deals" component={DealsScreen} options={{ title: 'Deals nearby' }} />
          <Stack.Screen name="CreateListing" component={CreateListingScreen} options={{ title: 'Sell something' }} />
          <Stack.Screen name="CreateService" component={CreateServiceScreen} options={{ title: 'Offer a service' }} />
          <Stack.Screen
            name="ChatRoom"
            component={ChatRoomScreen}
            options={({ route }) => ({ title: (route.params as any)?.title ?? 'Chat' })}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
