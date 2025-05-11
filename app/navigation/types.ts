import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Main: undefined;
  Dashboard: undefined;
  History: undefined;
  Profile: undefined;
  Settings: undefined;
  Settings_new: undefined;
  ManageTasks: undefined;
  Journal: undefined;
  // Add more screens as needed
  [key: string]: undefined | object | NavigatorScreenParams<any>;
};
